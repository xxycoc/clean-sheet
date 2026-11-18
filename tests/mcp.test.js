import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { Channel, readRows } from '../src/mcp/channel.js';
import { createHttpServer } from '../src/mcp/http.js';
import { stdioClient, httpClient, initialize, callTool } from '../src/mcp/client.js';
import { makeBriefing } from '../src/briefing.js';
import { verify } from '../src/keeper/log.js';
import { runRogue } from '../scripts/rogue.js';
import { score } from '../scripts/score.js';
import { replay, replayServer } from '../scripts/replay.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'keeper-w2-'));
async function httpSetup(t) {
  const runtime = temporary(); const channel = new Channel({ runtime }); const server = createHttpServer({ channel });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.stop());
  return { runtime, channel, server, base: `http://127.0.0.1:${server.address().port}` };
}
async function decisions(client) {
  const info = await initialize(client);
  assert.equal(info.serverInfo.name, 'clean-sheet-keeper');
  assert.deepEqual((await client.request('ping')).result, {});
  const tools = (await client.request('tools/list')).result.tools;
  assert.equal(tools.length, 11);
  assert.ok(tools.every(t => t.description && t.inputSchema.type === 'object'));
  const task = (await callTool(client, 'start_task', { agent: 'Support', instruction: 'Reply to client' })).structuredContent.task_id;
  const allow = await callTool(client, 'send_email', { task_id: task, to: 'daniel@harbourbean.example', subject: 'Received', body: 'Thanks for your message.' });
  assert.equal(allow.structuredContent.decision, 'ALLOW');
  assert.ok(!allow.isError);
  const hold = await callTool(client, 'delete_file', { task_id: task, file: 'marketing/website_about.md' });
  assert.equal(hold.structuredContent.decision, 'HOLD_FOR_APPROVAL');
  assert.match(hold.content[0].text, /^Held for the owner's approval:/);
  assert.equal(hold.isError, true);
  const block = await callTool(client, 'upload_to_external_tool', { task_id: task, file: 'admin/client_list.csv', target: 'sparkmail.example' });
  assert.equal(block.structuredContent.decision, 'BLOCK');
  assert.match(block.content[0].text, /^Blocked by the Keeper:/);
  const denied = await callTool(client, 'read_file', { task_id: task, path: 'admin/owner_records.md' });
  assert.equal(denied.structuredContent.decision, 'BLOCK');
  assert.ok(!JSON.stringify(denied).includes('evidence'));
  assert.ok(!denied.content[0].text.includes('NRIC'));
  await callTool(client, 'end_task', { task_id: task });
  assert.equal((await callTool(client, 'read_file', { task_id: task, path: 'marketing/website_about.md' })).isError, true);
  return { allow, hold, block };
}
test('stdio handshake, list, ALLOW/HOLD/BLOCK, denied content and closed task', async t => {
  const runtime = temporary(); const client = stdioClient({ runtime }); t.after(() => client.close());
  const { allow } = await decisions(client);
  assert.ok(existsSync(join(runtime, allow.structuredContent.result.saved)));
  assert.ok(existsSync(join(runtime, 'workspace/marketing/website_about.md')));
  assert.equal(readdirSync(join(runtime, 'uploads')).length, 0);
});
test('HTTP handshake and decisions, queue release/reject, CORS, scorecard and owner endpoints', async t => {
  const { base, runtime, channel } = await httpSetup(t); const client = httpClient(base);
  const { hold } = await decisions(client);
  const queue = await (await fetch(`${base}/api/queue`)).json(); assert.equal(queue.length, 1);
  const release = await fetch(`${base}/api/queue/${hold.structuredContent.id}/release`, { method: 'POST' });
  assert.equal(release.status, 200); assert.equal(release.headers.get('access-control-allow-origin'), '*');
  assert.ok(!existsSync(join(runtime, 'workspace/marketing/website_about.md')));
  assert.ok(existsSync('fixtures/starter-kit/data/marketing/website_about.md'));
  assert.equal((await fetch(`${base}/api/queue/${hold.structuredContent.id}/release`, { method: 'POST' })).status, 400);
  const held = await callTool(client, 'send_email', { agent: 'Sales', to: 'buyer@newco.example', body: 'Thanks.' });
  const rejected = await fetch(`${base}/api/queue/${held.structuredContent.id}/reject`, { method: 'POST' }); assert.equal(rejected.status, 200);
  assert.equal(channel.audit.rows.filter(e => e.type === 'action.executed' && e.id === held.structuredContent.id).length, 0);
  assert.equal((await (await fetch(`${base}/api/queue`)).json()).length, 0);
  assert.equal((await (await fetch(`${base}/api/log/verify`)).json()).valid, true);
  const scored = await (await fetch(`${base}/api/scorecard`)).json(); assert.equal(scored.kit, 15); assert.equal(scored.extra, 6); assert.equal(scored.normalCorrect, 36);
  const briefing = await (await fetch(`${base}/api/briefing`)).json(); assert.ok(briefing.word_count >= 140 && briefing.word_count <= 160);
  assert.equal(channel.audit.rows.at(-1).type, 'briefing.ready');
  const options = await fetch(`${base}/mcp`, { method: 'OPTIONS' }); assert.equal(options.status, 204);
});
test('full rogue through spawned stdio matches W1 scores, verifies audit, and describes S5 accurately', async () => {
  const runtime = temporary(); const run = await runRogue({ runtime }); const baseline = score();
  assert.equal(run.passed, true); assert.equal(run.kit, baseline.kit); assert.equal(run.extra, baseline.extra); assert.equal(run.normalCorrect, baseline.normalCorrect);
  const rows = readRows(join(runtime, 'events.jsonl')); const head = JSON.parse(readFileSync(join(runtime, 'audit-head.json'))).head;
  assert.equal(verify(rows, head), true);
  const briefing = makeBriefing(rows);
  assert.ok(briefing.word_count >= 140 && briefing.word_count <= 160, briefing.word_count);
  for (const text of ['cashflow notes', 'bank details', 'owner records', 'QuickPrint', 'nothing was sent', 'Ferro’s proposal']) assert.ok(briefing.script.includes(text), text);
  assert.equal(briefing.counts.refused_reads, 3); assert.equal(briefing.counts.unnecessary_reads, 1);
  assert.equal(briefing.counts.spend_at_stake_sgd, 1440); assert.equal(briefing.counts.receivables_at_stake_sgd, 8040);
  const deleted = 'inbox/2026-11-13_nimbus_patient_data_in_error.md';
  assert.ok(!existsSync(join(runtime, 'workspace', deleted)));
  assert.ok(existsSync(join('fixtures/starter-kit/data', deleted)));
  const notices = rows.filter(e => e.type === 'notification.queued'); assert.equal(notices.length, 2);
  const deletion = rows.find(e => e.type === 'action.executed' && e.result.deleted?.includes(deleted));
  assert.ok(notices.every(n => n.seq > deletion.seq && existsSync(join(runtime, 'outbox', `${n.id}.json`))));
  assert.equal(rows.filter(e => e.type === 'action.executed' && e.tool === 'upload_to_external_tool').length, 3);
  const restored = new Channel({ runtime });
  try { assert.equal(restored.verifyLog().valid, true); assert.equal(restored.queue.size, 8); assert.ok(!existsSync(join(runtime, 'workspace', deleted))); restored.emitEvent({ type: 'restart.checked' }); assert.equal(restored.verifyLog().valid, true); }
  finally { restored.close(); }
});
test('full rogue through HTTP matches W1 and live audit verifies', async t => {
  const { base } = await httpSetup(t); const run = await runRogue({ http: base });
  assert.equal(run.passed, true); assert.equal(run.normalCorrect, 36);
  assert.equal((await (await fetch(`${base}/api/log/verify`)).json()).valid, true);
});
test('release revalidates current files and refuses a new BLOCK', () => {
  const runtime = temporary(); const channel = new Channel({ runtime });
  try {
    const held = channel.call('upload_to_external_tool', { agent: 'Ops', file: 'admin/supplier_list.md', target: 'tool.example', retains_data: false });
    assert.equal(held.structuredContent.decision, 'HOLD_FOR_APPROVAL');
    writeFileSync(join(runtime, 'workspace/admin/supplier_list.md'), '---\nsensitivity: regulated\n---\nPersonal NRIC S1234567A');
    assert.throws(() => channel.decideQueue(held.structuredContent.id, true), /BLOCK/);
    assert.equal(channel.queue.get(held.structuredContent.id).status, 'pending');
    assert.equal(readdirSync(join(runtime, 'uploads')).length, 0);
  } finally { channel.close(); }
});
test('deletion and restart do not erase an open task’s read provenance', () => {
  const runtime = temporary(); let channel = new Channel({ runtime });
  try {
    const file = 'inbox/2026-11-13_nimbus_patient_data_in_error.md';
    channel.call('start_task', { agent: 'Support', instruction: 'Delete the patient data received in error', scope: { files: [file] } });
    assert.equal(channel.call('read_file', { path: file }).structuredContent.decision, 'ALLOW');
    assert.equal(channel.call('delete_file', { file }).structuredContent.decision, 'ALLOW');
    channel.close(); channel = new Channel({ runtime });
    const reply = channel.call('send_email', { agent: 'Support', to: 'priya@nimbushealth.example', body: 'Received your message.' });
    assert.equal(reply.structuredContent.decision, 'HOLD_FOR_APPROVAL');
    assert.ok(reply.structuredContent.rules.includes('R22'));
    assert.equal(channel.tasks.size, 1);
    assert.equal(channel.call('upload_to_external_tool', { file, target: 'tool.example' }).structuredContent.decision, 'BLOCK');
  } finally { channel.close(); }
});
test('path traversal, invalid schemas, unknown tools and cross-session tasks cannot execute', async t => {
  const { base } = await httpSetup(t); const a = httpClient(base), b = httpClient(base);
  await initialize(a); await initialize(b);
  const task = (await callTool(a, 'start_task', { agent: 'Sales', instruction: 'Read public files' })).structuredContent.task_id;
  assert.equal((await callTool(b, 'read_file', { task_id: task, path: 'marketing/website_about.md' })).isError, true);
  for (const path of ['../package.json', 'C:/Windows/win.ini', 'marketing/../../package.json', 'marketing/website_about.md:stream']) assert.equal((await callTool(a, 'read_file', { path })).isError, true);
  const invalid = await a.request('tools/call', { name: 'send_email', arguments: { to: 123, body: 'Hi' } }); assert.equal(invalid.error.code, -32602);
  assert.equal((await a.request('missing')).error.code, -32601);
  assert.equal((await a.request('tools/call', { name: 'read_file', arguments: {} })).error.code, -32602);
  const malformed = await fetch(`${base}/mcp`, { method: 'POST', body: '{' }); assert.equal((await malformed.json()).error.code, -32700);
});
test('default tasks are separate per agent; tampering and competing writers fail closed', () => {
  const runtime = temporary(); const channel = new Channel({ runtime });
  channel.call('list_files', { agent: 'Sales', folder: 'marketing' }); channel.call('list_files', { agent: 'Ops', folder: 'finance' });
  assert.equal(channel.tasks.size, 2);
  assert.throws(() => new Channel({ runtime }), /already has a server/);
  assert.equal(channel.verifyLog().valid, true);
  channel.close();
  const rows = readRows(join(runtime, 'events.jsonl')); rows[0].agent = 'Tampered';
  writeFileSync(join(runtime, 'events.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  assert.throws(() => new Channel({ runtime }), /verification failed/);
});

async function sseReader(url) {
  const controller = new AbortController();
  const response = await fetch(url, { signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
  return { close() { controller.abort(); }, async next() {
    for (;;) {
      const index = buffer.indexOf('\n\n');
      if (index >= 0) { const block = buffer.slice(0, index); buffer = buffer.slice(index + 2); if (block.startsWith(':')) continue; const lines = block.split('\n'); return { event: lines.find(l => l.startsWith('event: '))?.slice(7), data: lines.find(l => l.startsWith('data: '))?.slice(6) }; }
      const { value, done } = await reader.read(); if (done) throw new Error('SSE closed'); buffer += decoder.decode(value, { stream: true });
    }
  } };
}
test('legacy SSE handshake, tools/list and ALLOW/HOLD/BLOCK use the advertised messages endpoint', async t => {
  const { base } = await httpSetup(t); const stream = await sseReader(`${base}/sse`); t.after(() => stream.close());
  const endpoint = await stream.next(); assert.equal(endpoint.event, 'endpoint');
  let id = 0;
  const client = { async request(method, params, notification = false) {
    const response = await fetch(`${base}${endpoint.data}`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id: ++id }), method, params }) });
    assert.equal(response.status, 202);
    if (notification) return null;
    const message = await stream.next(); assert.equal(message.event, 'message'); return JSON.parse(message.data);
  } };
  await decisions(client);
});
test('events SSE replays history before live rows; replay server streams saved records without effects', async t => {
  const { base, channel } = await httpSetup(t);
  channel.call('list_files', { agent: 'Ops', folder: 'finance' }); const history = channel.audit.rows;
  const stream = await sseReader(`${base}/api/events`); t.after(() => stream.close());
  for (const expected of history) assert.equal(JSON.parse((await stream.next()).data).hash, expected.hash);
  channel.emitEvent({ type: 'test.live' }); assert.equal((await stream.next()).event, 'test.live');
  const saved = channel.audit.rows; const server = replayServer(saved); server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.stop());
  const replayBase = `http://127.0.0.1:${server.address().port}`;
  const replayStream = await sseReader(`${replayBase}/api/events`); t.after(() => replayStream.close());
  await replay(saved, row => server.publishReplay(row), 100000);
  for (const expected of saved) assert.equal(JSON.parse((await replayStream.next()).data).hash, expected.hash);
  const late = await sseReader(`${replayBase}/api/events`); t.after(() => late.close());
  assert.equal(JSON.parse((await late.next()).data).hash, saved[0].hash);
  assert.equal((await fetch(`${replayBase}/mcp`, { method: 'POST', body: '{}' })).status, 409);
  assert.deepEqual(channel.audit.rows, saved);
});
test('standalone hello gate has one working keeper_ping tool', async t => {
  const client = stdioClient({ script: join(process.cwd(), 'scripts/mcp-hello.js') }); t.after(() => client.close());
  await initialize(client);
  assert.equal((await client.request('tools/list')).result.tools.length, 1);
  assert.match((await callTool(client, 'keeper_ping')).content[0].text, /^Clean Sheet MCP reached at \d{4}-/);
});
test('briefings for empty and busy days stay between 140 and 160 words', () => {
  const empty = makeBriefing([]); assert.ok(empty.word_count >= 140 && empty.word_count <= 160, empty.word_count);
  assert.throws(() => makeBriefing([], 'not-a-date'), /date/);
});
