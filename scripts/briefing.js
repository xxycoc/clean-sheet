import { join } from 'node:path';
import { defaultRuntime, readRows } from '../src/mcp/channel.js';
import { makeBriefing } from '../src/briefing.js';
const briefing = makeBriefing(readRows(join(defaultRuntime(), 'events.jsonl')), process.argv[2]);
console.log(briefing.script);
console.log(JSON.stringify({ date: briefing.date, word_count: briefing.word_count, counts: briefing.counts }, null, 2));
