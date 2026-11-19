import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request } from 'node:http';
import { sceneAt, placeOverlay, home, ZONES } from '../public/floor/state.js';
import { Channel } from '../src/mcp/channel.js';
import { createHttpServer } from '../src/mcp/http.js';
import { loadFixtures } from '../src/fixtures.js';
import { createKeeper } from '../src/keeper/engine.js';
import { labelFile, highest } from '../src/keeper/labels.js';

const sample = JSON.parse(readFileSync(new URL('../public/floor/sample-events.json', import.meta.url)));
const event = (type, extra = {}) => ({ type, task_id: 't', agent: 'Sales', ...extra });
const sequence = [event('task.started'), event('file.read', { file: 'clients/proposal.md', level: 'client-confidential', in_scope: false }), event('action.proposed', { id: 'a', tool: 'send_email' }), event('keeper.decision', { id: 'a', decision: 'HOLD_FOR_APPROVAL', rules: ['R16'], evidence: [], owner_message: 'Needs approval.' }), event('approval.queued', { id: 'a' }), event('owner.decision', { id: 'a', released: true }), event('action.executed', { id: 'a' }), event('task.ended')];
test('scene derives locations, alerts, decisions, queue, owner release and home from events', () => {
  assert.equal(sceneAt(sequence, -1).agents.Sales.x, home('Sales').x);
  assert.equal(sceneAt(sequence, 0).agents.Sales.x, 1);
  assert.match(sceneAt(sequence, 1).alert, /^Out of scope: clients/);
  assert.equal(sceneAt(sequence, 1).agents.Sales.x, -5.2);
  assert.equal(sceneAt(sequence, 2).ball.phase, 'flight');
  assert.equal(sceneAt(sequence, 4).score.held, 1);
  assert.equal(sceneAt(sequence, 5).score.held, 0);
  assert.equal(sceneAt(sequence, 5).ball.phase, 'allow');
  assert.equal(sceneAt(sequence, 6).score.conceded, 0);
  assert.equal(sceneAt(sequence, 7).agents.Sales.z, home('Sales').z);
  const rejected = [...sequence.slice(0, 5), event('owner.decision', { id: 'a', released: false })];
  assert.equal(sceneAt(rejected).ball.phase, 'rejected'); assert.equal(sceneAt(rejected).score.held, 0);
});
test('real sample deterministically scrubs backwards, never mutates inputs, and shows S6 villain', () => {
  const before = JSON.stringify(sample);
  const read = sample.findIndex(e => e.type === 'file.read' && e.trust === 'untrusted');
  assert.ok(read >= 0); assert.equal(sceneAt(sample, read).villain, true);
  const blocked = sample.findIndex((e, i) => i > read && e.type === 'keeper.decision' && e.task_id === sample[read].task_id);
  assert.equal(sceneAt(sample, blocked).villain, false);
  const earlier = sceneAt(sample, read); sceneAt(sample); assert.deepEqual(sceneAt(sample, read), earlier);
  assert.equal(JSON.stringify(sample), before);
  assert.equal(sceneAt(sample).score.conceded, 0);
  assert.equal(sceneAt(sample).score.saves, new Set(sample.filter(e => e.type === 'keeper.decision' && e.decision === 'BLOCK').map(e => e.id)).size);
  assert.ok(!before.includes('observed_file'));
});
test('duplicate decisions and revalidation do not inflate score; execution without permission concedes', () => {
  const block = event('keeper.decision', { id: 'a', decision: 'BLOCK' });
  assert.equal(sceneAt([block, block, { ...block, revalidation: true }]).score.saves, 1);
  assert.equal(sceneAt([block, event('action.executed', { id: 'a' })]).score.conceded, 1);
  assert.equal(sceneAt([event('action.executed', { id: 'missing-proposal' })]).score.conceded, 1);
  assert.equal(sceneAt([...sequence.slice(0, 4), event('action.failed', { id: 'a', message: 'Missing file' })]).card.decision, 'FAILED');
});
test('unknown agents and events do not add cast members or throw', () => {
  const s = sceneAt([{ type: 'task.started', agent: 'Worker', task_id: 'w' }, { type: 'future.event' }]);
  assert.equal(Object.keys(s.agents).length, 5); assert.equal(s.activeAgent, null);
  assert.equal(sceneAt([], 400).index, -1);
  sceneAt([{ type: 'task.started', agent: '__proto__', task_id: '__proto__' }, { type: 'action.proposed', id: '__proto__' }]);
  assert.equal({}.activity, undefined);
});

test('blocked release revalidation keeps the approval pending until owner rejects it', () => {
  const pending = [...sequence.slice(0, 5), event('keeper.decision', { id: 'a', decision: 'BLOCK', revalidation: true })];
  assert.equal(sceneAt(pending).queue.length, 1);
  assert.equal(sceneAt(pending).score.held, 1);
  assert.equal(sceneAt(pending).card.decision, 'BLOCK');
  assert.equal(sceneAt([...pending, event('owner.decision', { id: 'a', released: false })]).queue.length, 0);
});
test('generated direct-file bundle matches its ES module sources', () => {
  const sources = ['state.js', 'characters.js', 'scene.js', 'app.js'].map(name => readFileSync(new URL('../public/floor/' + name, import.meta.url), 'utf8').replace(/^import .* from .*;\r?\n/gm, '').replace(/^export /gm, ''));
  const expected = `// Generated by node scripts/floor-build.js. Edit the source modules.\n(() => {\n'use strict';\n${sources.join('\n')}\n})();\n`;
  assert.equal(readFileSync(new URL('../public/floor/runtime.js', import.meta.url), 'utf8'), expected);
});
test('room baselines match highest actual fixture labels', () => {
  const k = createKeeper(loadFixtures());
  for (const z of ZONES.filter(z => z.level)) assert.equal(z.level, highest(Object.values(k.context.files).filter(f => f.path.startsWith(z.name.toLowerCase() + '/')).map(f => labelFile(f, k.context).level)), z.name);
});
test('overlay uses first clear in-bounds offset, otherwise docks top-left', () => {
  const first = placeOverlay({ x: 300, y: 300 }, [100, 50], { w: 600, h: 500 }, []);
  assert.deepEqual(first, { x: 320, y: 230, w: 100, h: 50, docked: false });
  const second = placeOverlay({ x: 300, y: 300 }, [100, 50], { w: 600, h: 500 }, [first]);
  assert.equal(second.x, 180);
  assert.equal(placeOverlay({ x: 0, y: 0 }, [100, 50], { w: 110, h: 60 }, []).docked, true);
});
test('floor static entry and modules are public; API protected; traversal and directories refused', async t => {
  const runtime = mkdtempSync(join(tmpdir(), 'floor-http-')); const channel = new Channel({ runtime });
  const server = createHttpServer({ channel, ownerToken: 'floor-test' }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.stop(); await once(server, 'close'); rmSync(runtime, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base + '/floor/'); assert.equal(page.status, 200); assert.match(await page.text(), /Good work. Safe hands./);
  assert.match((await fetch(base + '/floor/state.js')).headers.get('content-type'), /javascript/);
  assert.equal((await fetch(base + '/api/events')).status, 401);
  assert.equal((await fetch(base + '/floor/missing.js')).status, 404);
  const raw = path => new Promise((resolve, reject) => { request(base, { path }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject).end(); });
  for (const path of ['/floor/../package.json', '/floor/%2e%2e/package.json', '/floor/%2e%2e%2fsrc/mcp/http.js', '/floor/%5c..%5cpackage.json', '/floor/%00.js', '/floor/%E0%A4%A']) assert.ok([400, 404].includes(await raw(path)), path);
  const task = channel.call('start_task', { agent: 'Finance', instruction: 'Read inbound', scope: { files: ['inbox/2026-11-16_ferro_billing_lookalike.md'] } }).structuredContent.task_id;
  channel.call('read_file', { task_id: task, file: 'inbox/2026-11-16_ferro_billing_lookalike.md' });
  const rows = await (await fetch(base + '/api/log?token=floor-test')).json();
  assert.equal(rows.at(-1).trust, 'untrusted'); assert.equal(rows.at(-1).observed_file, undefined);
});
