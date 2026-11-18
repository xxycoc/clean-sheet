import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Channel, defaultRuntime } from './channel.js';
import { createProtocol, parseDispatch } from './protocol.js';
import { score } from '../../scripts/score.js';
import { makeBriefing } from '../briefing.js';

export function createHttpServer({ channel = new Channel(), replayRows = null, ownerToken = process.env.CLEAN_SHEET_OWNER_TOKEN } = {}) {
  if (!ownerToken) {
    ownerToken = randomBytes(32).toString('hex');
    const runtime = channel.runtime ?? defaultRuntime();
    mkdirSync(runtime, { recursive: true });
    const tokenPath = join(runtime, 'owner-token.txt');
    writeFileSync(tokenPath, ownerToken, { mode: 0o600 });
    console.error(`Owner token saved to ${tokenPath}`);
  }
  // Console views omit snapshots and text from denied sources, including nested queue entries.
  const sanitize = value => {
    const denied = new Map();
    for (const e of replayRows ?? channel.audit.rows) if (e.type === 'file.read' && e.decision !== 'ALLOW') {
      if (!denied.has(e.task_id)) denied.set(e.task_id, new Set());
      denied.get(e.task_id).add(e.file);
    }
    const walk = (item, taskId) => {
      if (Array.isArray(item)) return item.map(value => walk(value, taskId));
      if (!item || typeof item !== 'object') return item;
      taskId = item.task_id ?? item.task?.id ?? taskId;
      return Object.fromEntries(Object.entries(item).filter(([key]) =>
        !['observed_file', 'observed_files'].includes(key) &&
        !(denied.get(taskId)?.has(item.source) && key === 'text')).map(([key, value]) => [key, walk(value, taskId)]));
    };
    return walk(value);
  };
  const dispatch = createProtocol(channel);
  const sessions = new Map(); const streams = new Set(); const replayHistory = [];
  const json = (res, status, data, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(data === null ? undefined : JSON.stringify(sanitize(data))); };
  const sse = res => { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.flushHeaders(); };
  const frame = (res, event) => res.write(`id: ${event.seq ?? ''}\nevent: ${event.type}\ndata: ${JSON.stringify(sanitize(event))}\n\n`);
  const broadcast = event => { for (const res of streams) frame(res, event); };
  channel.on('event', broadcast);
  const handle = async (req, res) => {
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Session-Id, MCP-Protocol-Version, Last-Event-ID');
      res.setHeader('Access-Control-Expose-Headers', 'MCP-Session-Id');
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/') &&
          req.headers.authorization !== `Bearer ${ownerToken}` && url.searchParams.get('token') !== ownerToken) return json(res, 401, { error: 'Owner token required' });
      if (req.method === 'OPTIONS') return json(res, 204, null);
      if (req.method === 'GET' && url.pathname === '/api/events') {
        sse(res);
        for (const event of replayRows ? replayHistory : channel.audit.rows) frame(res, event);
        streams.add(res); res.on('close', () => streams.delete(res)); return;
      }
      if (req.method === 'GET' && url.pathname === '/sse') {
        const id = randomUUID(); sse(res); sessions.set(id, { res });
        res.write(`event: endpoint\ndata: /messages?sessionId=${id}\n\n`);
        res.on('close', () => sessions.delete(id)); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/queue') return json(res, 200, [...channel.queue.values()].filter(e => e.status === 'pending'));
      if (req.method === 'GET' && url.pathname === '/api/log/verify') return json(res, 200, channel.verifyLog());
      if (req.method === 'GET' && url.pathname === '/api/log') return json(res, 200, channel.audit.rows);
      if (req.method === 'GET' && url.pathname === '/api/scorecard') {
        const s = score(); return json(res, 200, { kit: s.kit, extra: s.extra, normalCorrect: s.normalCorrect, normalTotal: s.normals.length, falseAlarms: s.normals.filter(n => n.expected === 'ALLOW' && n.result.decision !== 'ALLOW').length, passed: s.passed, output: s.output });
      }
      if (req.method === 'GET' && url.pathname === '/api/briefing') {
        const briefing = makeBriefing(channel.audit.rows, url.searchParams.get('date') ?? undefined);
        if (!replayRows) channel.emitEvent({ type: 'briefing.ready', ...briefing });
        return json(res, 200, briefing);
      }
      if (req.method === 'DELETE' && url.pathname === '/mcp') { const id = req.headers['mcp-session-id']; if (!sessions.has(id)) return json(res, 404, { error: 'Unknown session' }); sessions.delete(id); return json(res, 204, null); }
      if (req.method !== 'POST') return json(res, 404, { error: 'Not found' });
      if (replayRows) return json(res, 409, { error: 'Replay is read-only' });
      const chunks = []; let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        // Bound request memory; attachment bytes are read by path, never uploaded in JSON.
        if (bytes > 1024 * 1024) return json(res, 413, { error: 'JSON body exceeds 1 MiB' });
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      const queueMatch = url.pathname.match(/^\/api\/queue\/([^/]+)\/(release|reject)$/);
      if (queueMatch) return json(res, 200, channel.decideQueue(queueMatch[1], queueMatch[2] === 'release'));
      if (url.pathname === '/mcp') {
        let request;
        try { request = JSON.parse(body); } catch { return json(res, 400, await parseDispatch(body, dispatch)); }
        let id = req.headers['mcp-session-id'];
        if (request?.method === 'initialize' && !id) { id = randomUUID(); sessions.set(id, {}); }
        if (!sessions.has(id)) return json(res, id ? 404 : 400, { error: 'Initialize first and send MCP-Session-Id' });
        const response = await dispatch(request, id);
        return json(res, response ? 200 : 202, response, { 'MCP-Session-Id': id });
      }
      if (url.pathname === '/messages') {
        const id = url.searchParams.get('sessionId'); const session = sessions.get(id);
        if (!session?.res) return json(res, 404, { error: 'Unknown SSE session' });
        const response = await parseDispatch(body, dispatch, id);
        if (response) session.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        return json(res, 202, null);
      }
      return json(res, 404, { error: 'Not found' });
    } catch (error) { if (!res.headersSent) json(res, 400, { error: error.message }); else res.end(); }
  };
  const server = createServer((req, res) => {
    void handle(req, res).catch(() => { res.destroy(); });
  });
  const heartbeat = setInterval(() => { for (const res of [...streams, ...[...sessions.values()].map(s => s.res).filter(Boolean)]) res.write(': keepalive\n\n'); }, 15000);
  heartbeat.unref();
  server.on('close', () => { clearInterval(heartbeat); channel.off('event', broadcast); channel.close(); });
  server.stop = () => { for (const res of [...streams, ...[...sessions.values()].map(s => s.res).filter(Boolean)]) res.end(); server.close(); server.closeAllConnections(); };
  server.publishReplay = event => { replayHistory.push(event); broadcast(event); };
  server.channel = channel;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = createHttpServer();
    server.listen(Number(process.env.PORT ?? 8787), process.env.HOST ?? '127.0.0.1', () => console.error(`Clean Sheet HTTP listening on ${JSON.stringify(server.address())}`));
    server.on('error', error => { console.error(error.message); server.channel.close(); process.exitCode = 1; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.stop());
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
