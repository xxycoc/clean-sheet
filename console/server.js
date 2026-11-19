'use strict';

/*
 * Keeper Console (test) - dynamic Node.js 22 server (built-ins only, no npm deps).
 *
 * Roles:
 *  1. Server-side proxy to the external Clean Sheet server. The browser cannot call
 *     it directly because its CORS preflight (OPTIONS) returns 401, so a custom
 *     Authorization header would be blocked in the browser. We forward
 *     "Authorization: Bearer <token>" from the server instead.
 *  2. Persistent store of every Approve/Reject decision via the page's own
 *     Supabase database (PostgREST), read back for the "My decisions" history.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8081', 10);
const HOST = process.env.HOST || '0.0.0.0';

// External Clean Sheet server (not a secret).
const UPSTREAM = (process.env.UPSTREAM_BASE ||
  'https://pope-hospitality-scsi-proposition.trycloudflare.com').replace(/\/+$/, '');
// Fallback bearer token if the client does not send one. The real owner token is
// entered in the UI and sent per request via the X-Upstream-Token header.
const DEFAULT_TOKEN = process.env.UPSTREAM_TOKEN || 'TOKEN';

// Supabase (injected by the QW Pages runtime after the DB is ready).
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const TABLE = 'keeper_decisions';

const PUB = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/* ----------------------------- helpers ----------------------------- */

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { reject(new Error('body too large')); req.destroy(); return; }
      data += c;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function bearerFrom(req) {
  const t = req.headers['x-upstream-token'];
  const token = (Array.isArray(t) ? t[0] : t) || DEFAULT_TOKEN;
  return String(token).trim() || DEFAULT_TOKEN;
}

// Call the external Clean Sheet server and return { status, ok, json, text }.
async function callUpstream(method, upPath, token, bodyObj) {
  const url = UPSTREAM + upPath;
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json'
  };
  let payload;
  if (bodyObj !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(bodyObj);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(url, { method, headers, body: payload, signal: controller.signal });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
    return { status: r.status, ok: r.ok, json, text };
  } catch (e) {
    return { status: 0, ok: false, json: null, text: '', error: String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

function supabaseHeaders() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

// Insert a decision row into the page's own database. Returns { ok, row, error }.
async function dbInsertDecision(row) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, error: 'database not configured at runtime' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + TABLE, {
      method: 'POST',
      headers: Object.assign({ 'Prefer': 'return=representation' }, supabaseHeaders()),
      body: JSON.stringify(row),
      signal: controller.signal
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* ignore */ }
    if (!r.ok) return { ok: false, error: (json && (json.message || json.error)) || text || ('HTTP ' + r.status) };
    return { ok: true, row: Array.isArray(json) ? json[0] : json };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

// Read recent decisions, newest first.
async function dbListDecisions(limit) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, error: 'database not configured at runtime', rows: [] };
  }
  const n = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/' + TABLE + '?order=created_at.desc&limit=' + n,
      { method: 'GET', headers: supabaseHeaders(), signal: controller.signal }
    );
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* ignore */ }
    if (!r.ok) return { ok: false, error: (json && (json.message || json.error)) || text || ('HTTP ' + r.status), rows: [] };
    return { ok: true, rows: Array.isArray(json) ? json : [] };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), rows: [] };
  } finally {
    clearTimeout(timer);
  }
}

function serveStatic(res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  rel = rel.replace(/^\/+/, '');
  const filePath = path.join(PUB, rel);
  if (!filePath.startsWith(PUB)) { sendJson(res, 403, { error: 'forbidden' }); return; }
  fs.readFile(filePath, (err, buf) => {
    if (err) { sendJson(res, 404, { error: 'not found' }); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

/* ----------------------------- router ----------------------------- */

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch (e) { sendJson(res, 400, { error: 'bad url' }); return; }
  const pathname = decodeURIComponent(url.pathname);

  try {
    // --- API: scorecard (proxy) ---
    if (req.method === 'GET' && pathname === '/api/scorecard') {
      const up = await callUpstream('GET', '/api/scorecard', bearerFrom(req));
      return sendJson(res, 200, {
        upstreamStatus: up.status,
        error: up.error || (up.json && up.json.error) || null,
        data: up.json
      });
    }

    // --- API: queue (proxy) ---
    if (req.method === 'GET' && pathname === '/api/queue') {
      const up = await callUpstream('GET', '/api/queue', bearerFrom(req));
      return sendJson(res, 200, {
        upstreamStatus: up.status,
        error: up.error || (up.json && up.json.error) || null,
        data: up.json
      });
    }

    // --- API: release / reject (proxy + record decision) ---
    const actMatch = pathname.match(/^\/api\/queue\/([^/]+)\/(release|reject)$/);
    if (req.method === 'POST' && actMatch) {
      const id = actMatch[1];
      const verb = actMatch[2]; // release => Approve, reject => Reject
      const decision = verb === 'release' ? 'Approve' : 'Reject';
      const body = await readBody(req);
      const token = bearerFrom(req);

      // 1) Forward the actual action to the Clean Sheet server.
      const up = await callUpstream('POST', '/api/queue/' + encodeURIComponent(id) + '/' + verb, token, {});

      // 2) Record the operator's decision in our own DB regardless of upstream outcome,
      //    storing the upstream status for transparency.
      const row = {
        item_id: String(id),
        agent: body.agent != null ? String(body.agent) : null,
        action: body.action != null ? String(body.action) : null,
        decision: decision,
        amount: body.amount != null ? String(body.amount) : null,
        recipient: body.recipient != null ? String(body.recipient) : null,
        reason: body.reason != null ? String(body.reason) : null
      };
      const rec = await dbInsertDecision(row);

      return sendJson(res, 200, {
        decision: decision,
        itemId: id,
        upstreamStatus: up.status,
        upstreamError: up.error || (up.json && up.json.error) || null,
        upstreamData: up.json,
        recorded: rec.ok,
        recordError: rec.error || null,
        savedRow: rec.row || null
      });
    }

    // --- API: decisions history (our DB) ---
    if (req.method === 'GET' && pathname === '/api/decisions') {
      const list = await dbListDecisions(url.searchParams.get('limit') || 200);
      return sendJson(res, 200, { ok: list.ok, error: list.error || null, rows: list.rows });
    }

    // --- API: status (what the server can see) ---
    if (req.method === 'GET' && pathname === '/api/status') {
      return sendJson(res, 200, {
        upstream: UPSTREAM,
        hasUpstream: Boolean(UPSTREAM),
        dbConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
      });
    }

    // --- static assets ---
    if (req.method === 'GET') return serveStatic(res, pathname);

    return sendJson(res, 405, { error: 'method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { error: 'server error', detail: String((err && err.message) || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log('[keeper-console] listening on http://' + HOST + ':' + PORT);
  console.log('[keeper-console] upstream = ' + UPSTREAM);
  console.log('[keeper-console] db configured = ' + Boolean(SUPABASE_URL && SUPABASE_ANON_KEY));
});
