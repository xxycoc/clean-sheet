// Standalone gate: no project imports, dependencies, workspace access, or effects.
import { createInterface } from 'node:readline';
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  let req;
  try { req = JSON.parse(line); } catch { console.log(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })); continue; }
  if (!req || req.jsonrpc !== '2.0' || typeof req.method !== 'string') { console.log(JSON.stringify({ jsonrpc: '2.0', id: req?.id ?? null, error: { code: -32600, message: 'Invalid Request' } })); continue; }
  if (!Object.hasOwn(req, 'id')) continue;
  let result;
  if (req.method === 'initialize') result = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'clean-sheet-hello', version: '1.0.0' } };
  if (req.method === 'ping') result = {};
  if (req.method === 'tools/list') result = { tools: [{ name: 'keeper_ping', description: 'Confirm that QwenWork can reach this MCP server.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }] };
  if (req.method === 'tools/call' && req.params?.name === 'keeper_ping') result = { content: [{ type: 'text', text: `Clean Sheet MCP reached at ${new Date().toISOString()}` }] };
  console.log(JSON.stringify({ jsonrpc: '2.0', id: req.id, ...(result ? { result } : { error: { code: -32601, message: 'Method or tool not found' } }) }));
}
