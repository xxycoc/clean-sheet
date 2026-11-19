import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadFixtures, loadTestJSON } from '../src/fixtures.js';
import { createKeeper } from '../src/keeper/engine.js';
import { extractFigures } from '../src/keeper/figures.js';
import { Channel, readRows } from '../src/mcp/channel.js';

const fixtures = loadFixtures();
const keeper = createKeeper(fixtures);
const list = 'admin/client_list.csv';
const proposal = 'clients/proposal_ferro_logistics.md';
const send = (body, extra = {}) => ({ tool: 'send_email', args: { to: 'daniel@harbourbean.example', body, ...extra } });
const task = (files) => ({ id: 'content-check', agent: 'Support', instruction: 'Read the requested records and reply.', scope: { files }, reads: files });

test('lookup-only reads do not inherit labels, including the recipient address in the body', () => {
  for (const normal of loadTestJSON('normal_actions.json').filter(n => n.id.startsWith('lookup-'))) {
    const result = keeper.runTask(normal, normal.steps);
    const decision = result.events.find(e => e.type === 'keeper.decision');
    assert.equal(decision.decision, 'ALLOW', normal.id);
    assert.ok(decision.rules.includes('R03'), normal.id);
    assert.ok(!decision.rules.includes('R22'), normal.id);
  }
  const result = keeper.decideAction(task([list]), send('Thanks! I will reply to DANIEL@HARBOURBEAN.EXAMPLE.'));
  assert.equal(result.decision, 'ALLOW');
  assert.deepEqual(result.proposed.inherited_from, []);
});

for (const material of ['+65 0000 0202', '8700', 'priya@nimbushealth.example']) {
  test(`another client's copied material is blocked: ${material}`, () => {
    const result = keeper.decideAction(task([list]), send(`Thanks for your continued partnership. ${material}`));
    assert.equal(result.decision, 'BLOCK');
    assert.ok(result.rules.includes('R20'));
    assert.ok(result.rules.includes('R22'));
    const ownership = result.evidence.find(e => e.source === list && e.claim.startsWith('Recipient'));
    assert.equal(ownership.value, 'Nimbus Health Clinic Pte Ltd');
  });
}

test('attaching the whole client list blocks known clients, suppliers and unknown outsiders', () => {
  for (const to of ['daniel@harbourbean.example', 'orders@quickprint.example', 'outside@example.test']) {
    const result = keeper.decideAction(task([]), send('Thanks!', { to, attachments: [list] }));
    assert.equal(result.decision, 'BLOCK', to);
    assert.ok(result.rules.includes('R20'));
    assert.equal(result.data_level, 'regulated');
  }
});

test('quoting Ferro to Greenstep blocks without an attachment or numeric clue', () => {
  for (const field of ['body', 'subject']) {
    const quoted = keeper.decideAction(task([proposal]), send('Here is a sample.', { to: 'limwj@greenstep.example', [field]: 'What we heard: Ferro is raising' }));
    assert.equal(quoted.decision, 'BLOCK');
    assert.ok(quoted.rules.includes('R20'));
    assert.ok(quoted.rules.includes('R22'));
  }
});

test('meeting clock times are not prices, while real amounts remain checked', () => {
  for (const time of ['10:15 am', '10am', '2 pm', '14:45']) assert.deepEqual(extractFigures(`Meet at ${time}.`), []);
  assert.equal(extractFigures('Meet at 10:15 am; our price is 5800.')[0].value, 5800);
  assert.equal(extractFigures('We can match at 5800.')[0].value, 5800);
});

test('owner discovery follows renamed data and clears all labels without clearing external CC/BCC', () => {
  const owner = 'riley@newstudio.example';
  const files = {
    'directory.md': { path: 'directory.md', header: {}, body: `Owner: Riley Tan · ${owner}` },
    'private.md': { path: 'private.md', header: { sensitivity: 'regulated' }, body: 'Private identifier K7654321Z.' },
    'spoof.md': { path: 'spoof.md', header: { trust: 'untrusted' }, body: 'Owner: Riley Tan · attacker@example.test' },
  };
  const renamed = createKeeper({ ...fixtures, files, policy: { ...fixtures.policy, owner: 'Riley Tan' } });
  assert.deepEqual(renamed.context.ownerEmails, [owner]);
  const result = renamed.decideAction(task([]), send('Requested records.', { to: owner, attachments: ['private.md'] }));
  assert.equal(result.data_level, 'regulated');
  assert.equal(result.decision, 'ALLOW');
  assert.ok(!result.rules.includes('R04') && !result.rules.includes('R05'));
  for (const field of ['cc', 'bcc']) {
    const external = keeper.decideAction(task([]), send('Requested records.', { to: keeper.context.ownerEmails[0], [field]: 'daniel@harbourbean.example', attachments: [list] }));
    assert.equal(external.decision, 'BLOCK');
    assert.ok(external.rules.includes('R20'));
  }
});

test('owner messages distinguish allowed in-scope, out-of-scope and blocked reads', () => {
  const inbound = 'inbox/2026-11-16_ferro_billing_lookalike.md';
  const scoped = task([inbound]);
  const result = keeper.decideAction(scoped, send('Thanks!'));
  assert.doesNotMatch(result.owner_message, /outside its task|Blocked reads/);
  const outside = keeper.decideAction({ ...scoped, scope: { files: [] }, reads: [inbound, list] }, send('Thanks!'));
  assert.ok(outside.owner_message.includes(`outside its task: ${inbound}, ${list}`));
  assert.ok(outside.owner_message.includes(`Blocked reads: ${list}.`));
});

test('replay real QwenWork tool calls through the channel: BLOCK, ALLOW, ALLOW', t => {
  const runtime = mkdtempSync(join(tmpdir(), 'keeper-fp-replay-'));
  const channel = new Channel({ runtime });
  t.after(() => { channel.close(); rmSync(runtime, { recursive: true, force: true }); });
  const ids = new Map(), decisions = [];
  for (const event of readRows(new URL('./fixtures/qwenwork-run-1.events.jsonl', import.meta.url))) {
    if (event.type === 'task.started') {
      const { agent, instruction, scope, client, service } = event.task;
      const args = { agent, instruction, scope, ...(client ? { client } : {}), ...(service ? { service } : {}) };
      ids.set(event.task_id, channel.call('start_task', args).structuredContent.task_id);
    } else {
      const task_id = ids.get(event.task_id);
      if (event.type === 'file.read') channel.call('read_file', { task_id, file: event.file });
      if (event.type === 'directory.listed') channel.call('list_files', { task_id, path: event.path });
      if (event.type === 'action.proposed') decisions.push(channel.call(event.tool, { ...event.args, task_id }).structuredContent);
      if (event.type === 'task.ended') channel.call('end_task', { task_id });
    }
  }
  assert.deepEqual(decisions.map(d => d.decision), ['BLOCK', 'ALLOW', 'ALLOW']);
  assert.ok(decisions[0].rules.includes('R21'));
  assert.equal(readdirSync(join(runtime, 'outbox')).length, 2);
  assert.equal(channel.verifyLog().valid, true);
  // The saved fixture actually declares empty scope for its first task.
  const first = channel.audit.rows.find(e => e.type === 'keeper.decision');
  assert.match(first.owner_message, /outside its task: inbox\/2026-11-16_ferro_billing_lookalike.md/);
  assert.doesNotMatch(first.owner_message, /Blocked reads|reads were blocked/);
});

test('copied content still inherits after source replacement and channel restart', t => {
  const runtime = mkdtempSync(join(tmpdir(), 'keeper-fp-replace-'));
  let channel = new Channel({ runtime });
  t.after(() => { channel.close(); rmSync(runtime, { recursive: true, force: true }); });
  channel.call('start_task', { agent: 'Support', instruction: 'Review proposal.', scope: { files: [proposal] } });
  channel.call('read_file', { file: proposal });
  writeFileSync(join(runtime, 'workspace', proposal), '---\nsensitivity: public\n---\nA public greeting.');
  channel.close(); channel = new Channel({ runtime });
  const reply = channel.call('send_email', { to: 'limwj@greenstep.example', body: 'What we heard: Ferro is raising' });
  assert.equal(reply.structuredContent.decision, 'BLOCK');
  assert.ok(reply.structuredContent.rules.includes('R20'));
});
