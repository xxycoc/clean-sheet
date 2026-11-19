'use strict';

/* Keeper Console (test) - frontend logic. Talks only to our own server (/api/*),
   which proxies the Clean Sheet upstream and stores decisions in the app DB. */

const UPSTREAM_TOKEN_KEY = 'keeper_token_v1';
const REFRESH_MS = 5000;

const $ = (id) => document.getElementById(id);
const tokenInput = $('token');

/* ---------- token handling ---------- */
function getToken() {
  let t = localStorage.getItem(UPSTREAM_TOKEN_KEY);
  if (t === null) { t = 'TOKEN'; localStorage.setItem(UPSTREAM_TOKEN_KEY, t); }
  return t;
}
function setToken(t) { localStorage.setItem(UPSTREAM_TOKEN_KEY, t); }

/* ---------- small utils ---------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return null;
}

function firstNonEmpty(vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

function humanize(s) {
  return String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

const TOOL_VERBS = {
  pay_supplier: 'Pay',
  send_email: 'Email',
  order_from_supplier: 'Order from',
  quote_price: 'Quote',
  upload_to_external_tool: 'Upload to',
  delete_file: 'Delete',
  read_file: 'Read',
  list_files: 'List files',
  start_task: 'Start task',
  end_task: 'End task',
  accept_terms: 'Accept terms'
};

function formatMoney(amount, currency) {
  const n = Number(amount);
  if (!isFinite(n)) return null;
  const cur = currency ? String(currency) : 'SGD';
  return cur + ' ' + n.toLocaleString('en-US');
}

// Build a human-readable action label from the pinned action shape:
//   action.tool + action.args  ->  e.g. "Pay Harbour Print SGD 2,300"
function readableAction(action) {
  const tool = (action && action.tool) || '';
  const args = (action && action.args) || {};
  const verb = TOOL_VERBS[tool] || humanize(tool) || 'Action';
  const money = args.amount != null ? formatMoney(args.amount, args.currency) : null;
  const target = firstNonEmpty([
    args.supplier, args.to, args.recipient, args.client, args.contact,
    args.file, args.path, args.tool, args.service, args.subject
  ]);
  const parts = [verb];
  if (target) parts.push(String(target));
  if (money) parts.push(money);
  return parts.join(' ').trim();
}
function toast(msg, kind) {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (kind || '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast ' + (kind || ''); }, 4200);
}

async function api(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'X-Upstream-Token': getToken() }, opts.headers || {});
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(path, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* ignore */ }
  if (!r.ok) throw new Error((json && (json.error || json.detail)) || ('HTTP ' + r.status));
  return json;
}

/* ---------- scorecard ---------- */
async function loadScorecard() {
  const box = $('scoreTotals');
  const raw = $('scoreRaw');
  try {
    const res = await api('/api/scorecard');
    const data = res.data || {};
    if (res.upstreamStatus === 401 || (res.error && /token/i.test(String(res.error)))) {
      box.innerHTML = '<p class="warn">Upstream says: <b>' + esc(res.error || 'Owner token required') +
        '</b>. Enter your real owner token above and press Save.</p>';
      raw.textContent = JSON.stringify(res, null, 2);
      return;
    }
    const kit = Number(data.kit);
    const extra = Number(data.extra);
    const normalCorrect = Number(data.normalCorrect);
    const normalTotal = Number(data.normalTotal);
    const falseAlarms = Number(data.falseAlarms);
    const passed = data.passed === true;
    // Totals are maxima of the suite: 15 points over the 5 AvePoint scenarios, 6 over our 2.
    box.className = '';
    box.innerHTML = (passed ? '<strong>All passing.</strong> ' : '<span class="warn">Not passing.</span> ') +
      esc(kit) + '/15 on AvePoint’s scenarios, ' + esc(extra) + '/6 on ours, and ' +
      esc(normalCorrect) + '/' + esc(normalTotal) + ' everyday actions let through with ' +
      esc(falseAlarms) + ' false alarm' + (falseAlarms === 1 ? '' : 's') + '.';
    // The long "output" text table belongs in the collapsible raw section.
    raw.textContent = (typeof data.output === 'string' && data.output.length)
      ? data.output
      : JSON.stringify(res, null, 2);
  } catch (e) {
    box.innerHTML = '<p class="warn">Scorecard error: ' + esc(e.message) + '</p>';
  }
}

/* ---------- queue ---------- */
function normalizeQueue(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const key of ['items', 'queue', 'pending', 'rows', 'data', 'result', 'results']) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [];
}

async function loadQueue() {
  const box = $('queueList');
  const meta = $('queueMeta');
  try {
    const res = await api('/api/queue');
    if (res.upstreamStatus === 401 || (res.error && /token/i.test(String(res.error)))) {
      meta.textContent = 'needs token';
      box.innerHTML = '<p class="warn">Upstream says: <b>' + esc(res.error || 'Owner token required') +
        '</b>. Enter your real owner token above and press Save, then Refresh.</p>';
      return;
    }
    const items = normalizeQueue(res.data);
    meta.textContent = (items.length ? items.length + ' held · ' : '') + 'updated ' +
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (!items.length) { box.innerHTML = '<p class="muted">Nothing is waiting. Held actions appear here.</p>'; return; }

    box.innerHTML = items.map((it) => {
      // Pinned shape: id, task.{agent,instruction}, action.{tool,args},
      // decision.{decision,rules[],owner_message,evidence[]}
      const id = it.id;
      const agent = (it.task && it.task.agent) || '—';
      const actionObj = it.action || {};
      const args = actionObj.args || {};
      const actionStr = readableAction(actionObj);
      const decisionObj = it.decision || {};
      const rules = Array.isArray(decisionObj.rules) ? decisionObj.rules : [];
      const reason = decisionObj.owner_message;
      const amount = args.amount != null ? args.amount : '';
      const recipient = firstNonEmpty([args.supplier, args.to, args.recipient, args.client]) || '';

      const ruleText = rules.length ? ' · rule <span class="rule">' + rules.map((r) => esc(String(r))).join(', ') + '</span>' : '';
      const canAct = id !== null && id !== undefined;
      const dataAttr = 'data-id="' + esc(String(id != null ? id : '')) + '" data-agent="' + esc(agent) +
        '" data-action="' + esc(actionStr) + '" data-amount="' + esc(amount) +
        '" data-recipient="' + esc(recipient) + '" data-reason="' + esc(reason != null ? reason : '') + '"';

      return (
        '<article class="qitem" aria-label="' + esc(actionStr) + '">' +
          '<div>' +
            '<p class="qaction">' + esc(actionStr) + '</p>' +
            '<p class="qreason">' + esc(reason != null && String(reason).trim() !== '' ? reason : '(no reason given)') + '</p>' +
            '<p class="qmeta">' + esc(agent) + ' agent' + ruleText + '</p>' +
          '</div>' +
          '<div class="qbtns">' +
            (canAct
              ? '<button class="btn approve" type="button" ' + dataAttr + ' data-act="release">Approve</button>' +
                '<button class="btn reject" type="button" ' + dataAttr + ' data-act="reject">Reject</button>'
              : '<span class="muted">no id</span>') +
          '</div>' +
        '</article>'
      );
    }).join('');
  } catch (e) {
    meta.textContent = 'error';
    box.innerHTML = '<p class="warn">Queue error: ' + esc(e.message) + '</p>';
  }
}

/* ---------- decisions ---------- */
async function loadDecisions() {
  const body = $('decBody');
  const meta = $('decMeta');
  try {
    const res = await api('/api/decisions');
    if (!res.ok) {
      meta.textContent = '';
      body.innerHTML = '<tr><td colspan="5" class="warn">Database error: ' + esc(res.error || 'unknown') + '</td></tr>';
      return;
    }
    const rows = res.rows || [];
    meta.textContent = rows.length ? ('Saved in this console’s database · ' + rows.length) : '';
    if (!rows.length) { body.innerHTML = '<tr><td colspan="5" class="muted">No decisions yet.</td></tr>'; return; }
    body.innerHTML = rows.map((r) => {
      const when = r.created_at ? new Date(r.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
      const approved = r.decision === 'Approve';
      return '<tr title="Item ' + esc(r.item_id != null ? r.item_id : '') + '">' +
        '<td class="when">' + esc(when) + '</td>' +
        '<td class="agent">' + esc(r.agent || '—') + '</td>' +
        '<td class="action">' + esc(r.action || '—') + '</td>' +
        '<td class="decision ' + (approved ? 'd-approve' : 'd-reject') + '">' + (approved ? 'Approved' : 'Rejected') + '</td>' +
        '<td class="reason">' + esc(r.reason || '—') + '</td></tr>';
    }).join('');
  } catch (e) {
    body.innerHTML = '<tr><td colspan="5" class="warn">History error: ' + esc(e.message) + '</td></tr>';
  }
}

/* ---------- acting on an item ---------- */
async function act(btn) {
  const id = btn.getAttribute('data-id');
  const verb = btn.getAttribute('data-act'); // release | reject
  const payload = {
    agent: btn.getAttribute('data-agent') || null,
    action: btn.getAttribute('data-action') || null,
    amount: btn.getAttribute('data-amount') || null,
    recipient: btn.getAttribute('data-recipient') || null,
    reason: btn.getAttribute('data-reason') || null
  };
  const other = btn.parentElement.querySelectorAll('button');
  other.forEach((b) => { b.disabled = true; });
  btn.classList.add('busy');
  try {
    const res = await api('/api/queue/' + encodeURIComponent(id) + '/' + verb, { method: 'POST', body: payload });
    if (res.upstreamStatus && res.upstreamStatus >= 400) {
      toast((verb === 'release' ? 'Approve' : 'Reject') + ' #' + id + ': upstream ' + res.upstreamStatus +
        (res.upstreamError ? ' — ' + res.upstreamError : ''), 'warn');
    } else {
      toast('Recorded ' + (res.decision) + ' for #' + id + (res.recorded ? ' (saved)' : ' — DB save failed'), res.recorded ? 'ok' : 'warn');
    }
  } catch (e) {
    toast('Action failed: ' + e.message, 'warn');
  } finally {
    btn.classList.remove('busy');
    other.forEach((b) => { b.disabled = false; });
    loadQueue();
    loadDecisions();
  }
}

/* ---------- status pill ---------- */
async function loadStatus() {
  const el = $('connState');
  try {
    const s = await api('/api/status');
    el.textContent = (s.dbConfigured ? 'Database connected' : 'Database not connected');
    el.className = 'conn-state ' + (s.dbConfigured ? 'good' : 'bad');
    el.title = 'upstream: ' + s.upstream;
  } catch (e) {
    el.textContent = 'Console server not reachable';
    el.className = 'conn-state bad';
  }
}

/* ---------- wiring ---------- */
function init() {
  tokenInput.value = getToken();
  $('tokenForm').addEventListener('submit', (e) => {
    e.preventDefault();
    setToken(tokenInput.value.trim() || 'TOKEN');
    toast('Token saved', 'ok');
    loadScorecard(); loadQueue(); loadStatus(); loadDecisions();
  });

  $('refreshQueue').addEventListener('click', loadQueue);

  $('queueList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (btn && !btn.disabled) act(btn);
  });

  loadStatus();
  loadScorecard();
  loadQueue();
  loadDecisions();
  setInterval(loadQueue, REFRESH_MS);
}

document.addEventListener('DOMContentLoaded', init);
