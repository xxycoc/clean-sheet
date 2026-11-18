import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { join } from 'node:path';
import { projectRoot } from './channel.js';

export function stdioClient({ runtime, script = join(projectRoot, 'src/mcp/stdio.js') } = {}) {
  const child = spawn(process.execPath, [script], { cwd: projectRoot, env: { ...process.env, ...(runtime ? { KEEPER_RUNTIME: runtime } : {}) }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let seq = 0, stderr = '';
  const pending = new Map();
  child.stderr.on('data', chunk => { stderr += chunk; });
  createInterface({ input: child.stdout }).on('line', line => {
    let response;
    try { response = JSON.parse(line); } catch { return; }
    const waiter = pending.get(response.id);
    if (waiter) { clearTimeout(waiter.timer); pending.delete(response.id); waiter.resolve(response); }
  });
  child.on('exit', code => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(`MCP exited ${code}: ${stderr}`)); } pending.clear(); });
  child.on('error', error => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); });
  return {
    child,
    request(method, params, notification = false) {
      const id = ++seq;
      const message = { jsonrpc: '2.0', ...(notification ? {} : { id }), method, ...(params ? { params } : {}) };
      if (notification) { child.stdin.write(`${JSON.stringify(message)}\n`); return Promise.resolve(null); }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP response timed out: ${method}; ${stderr}`)); }, 10000);
        pending.set(id, { resolve, reject, timer }); child.stdin.write(`${JSON.stringify(message)}\n`);
      });
    },
    async close() { if (child.exitCode !== null) return; const done = once(child, 'exit'); child.stdin.end(); await done; },
  };
}
export function httpClient(base) {
  let seq = 0, session;
  return {
    async request(method, params, notification = false) {
      const response = await fetch(`${base.replace(/\/$/, '')}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { 'MCP-Session-Id': session } : {}) },
        body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id: ++seq }), method, ...(params ? { params } : {}) }), signal: AbortSignal.timeout(10000) });
      session = response.headers.get('mcp-session-id') ?? session;
      if (!response.ok) throw new Error(`HTTP MCP ${response.status}: ${await response.text()}`);
      return response.status === 202 ? null : response.json();
    },
    async close() { if (session) await fetch(`${base.replace(/\/$/, '')}/mcp`, { method: 'DELETE', headers: { 'MCP-Session-Id': session }, signal: AbortSignal.timeout(10000) }); },
  };
}
export async function initialize(client) {
  const response = await client.request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'clean-sheet-runner', version: '1.0.0' } });
  if (response.error) throw new Error(JSON.stringify(response.error));
  await client.request('notifications/initialized', {}, true);
  return response.result;
}
export async function callTool(client, name, args = {}) {
  const response = await client.request('tools/call', { name, arguments: args });
  if (response.error) throw new Error(JSON.stringify(response.error));
  return response.result;
}
