import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { readRows } from '../src/mcp/channel.js';
import { verify } from '../src/keeper/log.js';
import { createHttpServer } from '../src/mcp/http.js';

export async function replay(rows, publish, speed = 4, signal) {
  if (!Number.isFinite(speed) || speed <= 0) throw new Error('speed must be positive');
  let previous = Date.parse(rows[0]?.time);
  for (const row of rows) {
    const current = Date.parse(row.time);
    if (!Number.isFinite(current)) throw new Error('Invalid event time');
    const delay = Math.max(0, (current - previous) / speed);
    if (delay) await setTimeout(delay, undefined, { signal });
    if (signal?.aborted) break;
    publish(row); previous = current;
  }
}
export function verifyReplay(rows, expected) {
  return Number.isInteger(expected?.count) && expected.count === rows.length &&
    typeof expected.head === 'string' && verify(rows, expected.head);
}
export function replayServer(rows, expected, options = {}) {
  if (!verifyReplay(rows, expected)) throw new Error('Replay verification failed: expected count and head required');
  const channel = new EventEmitter();
  const history = [];
  channel.audit = { get rows() { return history; } }; channel.queue = new Map(); channel.close = () => {};
  channel.verifyLog = () => ({ valid: verifyReplay(rows, expected), rows: rows.length, replay: true });
  const server = createHttpServer({ ...options, channel, replayRows: rows });
  const publish = server.publishReplay;
  server.publishReplay = event => { history.push(event); publish(event); };
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node scripts/replay.js runtime/events.jsonl --speed 4');
    const rows = readRows(process.argv[2]);
    const expected = JSON.parse(readFileSync(join(dirname(process.argv[2]), 'audit-head.json'), 'utf8'));
    if (!rows.length || !verifyReplay(rows, expected)) throw new Error('Replay requires a nonempty, valid hash-chained event log');
    const index = process.argv.indexOf('--speed'); const speed = index < 0 ? 4 : Number(process.argv[index + 1]);
    if (!Number.isFinite(speed) || speed <= 0) throw new Error('speed must be positive');
    const server = replayServer(rows, expected); const controller = new AbortController();
    server.listen(Number(process.env.PORT ?? 8787), process.env.HOST ?? '127.0.0.1', async () => {
      console.log('Replay serving /api/events; history is replayed to late viewers.');
      try { await replay(rows, row => server.publishReplay(row), speed, controller.signal); console.log(`Replayed ${rows.length} events; server remains available until stopped.`); }
      catch (error) { if (error.name !== 'AbortError') console.error(error.message); }
    });
    server.on('error', error => { console.error(error.message); server.stop(); process.exitCode = 1; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { controller.abort(); server.stop(); });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
