import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runRogue } from './rogue.js';
import { projectRoot } from '../src/mcp/channel.js';

const run = await runRogue();
if (!run.passed) throw new Error(run.output);
// Match the owner stream: omit file snapshots and denied source text.
const denied = new Map();
for (const e of run.events) if (e.type === 'file.read' && e.decision !== 'ALLOW') {
  if (!denied.has(e.task_id)) denied.set(e.task_id, new Set());
  denied.get(e.task_id).add(e.file);
}
function clean(value, taskId) {
  if (Array.isArray(value)) return value.map(v => clean(v, taskId));
  if (!value || typeof value !== 'object') return value;
  taskId = value.task_id ?? value.task?.id ?? taskId;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !['observed_file', 'observed_files'].includes(key) && !(key === 'text' && denied.get(taskId)?.has(value.source))).map(([k, v]) => [k, clean(v, taskId)]));
}
const events = clean(run.events);
const folder = join(projectRoot, 'public/floor'); mkdirSync(folder, { recursive: true });
writeFileSync(join(folder, 'sample-events.json'), JSON.stringify(events, null, 2) + '\n');
// Classic script also works on file://, where fetch and external ES modules are blocked.
writeFileSync(join(folder, 'sample-events.js'), `globalThis.FLOOR_SAMPLE = ${JSON.stringify(events)};\n`);
console.log(`${run.output}\nSaved ${events.length} real channel events.`);
