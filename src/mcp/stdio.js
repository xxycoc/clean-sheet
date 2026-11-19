import { realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { Channel } from './channel.js';
import { createProtocol, parseDispatch } from './protocol.js';

export async function serveStdio(channel, definitions) {
  const dispatch = createProtocol(channel, definitions);
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const response = await parseDispatch(line, dispatch, 'stdio');
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  } finally { channel.close?.(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const channel = new Channel();
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { channel.close(); process.exit(0); });
    await serveStdio(channel);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
