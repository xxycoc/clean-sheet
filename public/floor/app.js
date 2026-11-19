import { sceneAt, STAFF, ZONES, COLORS, placeOverlay } from './state.js';
import { createFloor } from './scene.js';

const $ = id => document.getElementById(id);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const token = new URLSearchParams(location.search).get('token');
const types = ['task.started', 'task.ended', 'file.read', 'directory.listed', 'action.proposed', 'keeper.decision', 'approval.queued', 'owner.decision', 'action.executed', 'action.failed', 'notification.queued', 'briefing.ready'];
let events = [], index = -1, state = sceneAt([], -1), mode = 'sample', playing = false, timer, stream, seen = new Set(), liveReady = false, historyTimer;
let floor, loading = false, failed = '', frame = 0, flatMode = true, lastFocus, selected;
const tone = decision => decision === 'BLOCK' || decision === 'FAILED' ? '#ff97a1' : decision === 'HOLD_FOR_APPROVAL' ? '#ffd280' : decision === 'ALLOW' ? '#91e8b4' : '#9cdbe4';
const text = (tag, value, parent) => { const e = document.createElement(tag); e.textContent = value; parent.append(e); return e; };

function inspect(key) {
  selected = key;
  const agent = Object.hasOwn(state.agents, key) ? state.agents[key] : null;
  const record = agent ? agent.decision : state.card?.id === key ? state.card : state.actions[key]?.decision ?? state.card;
  $('drawer-title').textContent = agent ? `${key} · ${record?.decision ?? 'Working'}` : record?.decision ?? 'No decision yet';
  $('drawer-content').replaceChildren();
  const target = $('drawer-content');
  text('p', record?.owner_message ?? agent?.activity ?? 'Select a recorded action to inspect its decision.', target);
  text('h3', 'Rules cited', target); text('p', record?.rules?.join(' · ') || 'No rules cited in this event.', target);
  text('h3', 'Evidence', target);
  if (record?.evidence?.length) for (const e of record.evidence) { const article = document.createElement('article'); target.append(article); text('h4', e.claim ?? 'Evidence', article); text('p', e.source ?? '', article); text('pre', typeof e.value === 'string' ? e.value : JSON.stringify(e.value ?? null, null, 2), article); if (e.text) text('p', e.text, article); }
  else text('p', 'No evidence recorded for this event.', target);
  if (record?.owner) { text('h3', 'Owner decision', target); text('p', record.owner.released ? 'Released by owner' : 'Rejected by owner', target); }
  if (agent) { text('h3', 'Current activity', target); text('p', agent.activity, target); }
  if ($('drawer').hidden) { lastFocus = document.activeElement; $('drawer').hidden = $('shade').hidden = false; document.querySelector('main').inert = true; $('close').focus(); }
}
function closeDrawer() { $('drawer').hidden = $('shade').hidden = true; document.querySelector('main').inert = false; lastFocus?.focus(); }
$('close').onclick = $('shade').onclick = closeDrawer;
document.addEventListener('keydown', e => { if ($('drawer').hidden) return; if (e.key === 'Escape') closeDrawer(); if (e.key === 'Tab') { e.preventDefault(); $('close').focus(); } });
$('card').onclick = () => inspect(state.card?.id ?? 'Keeper');

function portrait(name) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 48 56'); svg.setAttribute('aria-hidden', 'true');
  const add = (tag, attrs) => { const node = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v); svg.append(node); };
  const color = name === 'Keeper' ? '#e2e6ee' : '#c9b6f2';
  for (let i = 0; i < 8; i++) add('path', { d: `M24 35 Q${5 + i * 5} 50 ${4 + i * 5.5} ${42 + i % 2 * 6}`, fill: 'none', stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round' });
  add('ellipse', { cx: 24, cy: 27, rx: 17, ry: 16, fill: color });
  for (const cx of [16, 32]) { add('circle', { cx, cy: 27, r: 4, fill: '#182c43' }); if (name !== 'Keeper') add('circle', { cx, cy: 27, r: 6, fill: 'none', stroke: '#65d9e7', 'stroke-width': 2 }); }
  if (name === 'Ops') { add('path', { d: 'M7 17 Q24 -6 41 17Z', fill: '#ffd36b' }); add('path', { d: 'M4 18H44', stroke: '#ffd36b', 'stroke-width': 4 }); }
  if (name === 'Finance' || name === 'Keeper') add('path', { d: 'M7 17Q24 4 39 17H43V21H7Z', fill: '#459c73' });
  if (name === 'Keeper') { add('path', { d: 'M12 36Q24 42 36 36V44H12Z', fill: '#2bd47d' }); add('path', { d: 'M23 37L25 36V43', stroke: 'white', 'stroke-width': 2, fill: 'none' }); }
  if (name === 'Marketing') add('path', { d: 'M10 15L11 4L17 10L24 2L31 10L37 4L38 15Z', fill: '#efbe57' });
  if (name === 'Sales') { add('path', { d: 'M21 39L27 39L29 49L24 53L19 49Z', fill: '#f57982' }); add('path', { d: 'M10 15Q19 2 34 11', stroke: '#706391', 'stroke-width': 5, fill: 'none' }); }
  if (name === 'Support') add('path', { d: 'M5 29V18Q24 -2 43 18V30L34 34', stroke: '#ec9eab', 'stroke-width': 4, fill: 'none' });
  return svg;
}
function flat() {
  $('flat').replaceChildren();
  const cells = new Map();
  for (const z of state.rooms) {
    const el = document.createElement('section'); el.className = 'flat-zone'; el.style.setProperty('--color', COLORS[z.level] ?? '#7bb2a5');
    text('h3', z.name, el); text('small', z.level ?? (z.name === 'Outside' ? 'Outbox · Uploads · Supplier' : z.name === 'Keeper' ? 'Rules as code' : 'AI staff'), el);
    $('flat').append(el); cells.set(z.name, el);
  }
  for (const [name, a] of Object.entries(state.agents)) {
    const room = ZONES.find(z => z.level && Math.abs(z.x + .5 - a.x) < .2 && Math.abs(z.z + .3 - a.z) < .2);
    const el = document.createElement('button'); el.className = 'flat-agent'; el.append(portrait(name)); text('span', name, el); el.onclick = () => inspect(name); if (name !== state.activeAgent) el.style.opacity = '.5'; cells.get(room?.name ?? 'Staff').append(el);
  }
  const keeper = document.createElement('button'); keeper.className = 'flat-agent'; keeper.append(portrait('Keeper')); text('span', 'Keeper', keeper); keeper.onclick = () => inspect('Keeper'); cells.get('Keeper').append(keeper);
  if (state.villain) text('p', '🦑 Untrusted sender at the window', cells.get('Inbox')).className = 'flat-villain';
  if (state.ball) { const b = document.createElement('button'); b.className = 'flat-ball'; b.textContent = `● ${state.ball.phase === 'allow' || state.ball.phase === 'outside' ? '✓ Allowed' : state.ball.phase === 'hold' ? 'Held for approval' : state.ball.phase === 'save' ? 'Saved' : state.ball.phase}`; b.onclick = () => inspect(state.ball.id); cells.get(['allow', 'outside'].includes(state.ball.phase) ? 'Outside' : 'Keeper').append(b); }
}
function layout(info) {
  if (flatMode) return;
  const bounds = { w: $('stage').clientWidth, h: $('stage').clientHeight };
  const occupied = info.occupied;
  for (const id of ['card', 'bubble']) {
    const el = $(id); if (el.hidden) continue;
    const r = flatMode ? { x: 12, y: bounds.h - (id === 'card' ? el.offsetHeight + 12 : $('card').offsetHeight + el.offsetHeight + 24), w: el.offsetWidth, h: el.offsetHeight } : placeOverlay(info.anchor, [el.offsetWidth, el.offsetHeight], bounds, occupied);
    // Reserve a separate top-left slot when both overlays need docking.
    if (r.docked && id === 'bubble' && !$('card').hidden && $('card').dataset.docked === 'true') r.y += $('card').offsetHeight + 12;
    el.style.left = `${r.x}px`; el.style.top = `${r.y}px`; el.dataset.docked = String(!!r.docked); occupied.push(r);
  }
}
function draw(now) {
  frame = 0; if (document.hidden) return;
  const info = flatMode || !floor ? { active: false, anchor: { x: 0, y: 0 }, occupied: [] } : floor.draw(now);
  layout(info); if (info.active) requestDraw();
}
function requestDraw() { if (!frame && !document.hidden) frame = requestAnimationFrame(draw); }
function refresh(animate = false) {
  state = sceneAt(events, index); index = state.index;
  for (const k of ['saves', 'held', 'conceded']) $(k).textContent = state.score[k];
  $('cursor').max = Math.max(-1, events.length - 1); $('cursor').value = index; $('position').textContent = `${index + 1} / ${events.length}`;
  $('event-type').textContent = state.event?.type ?? 'Ready';
  $('event-detail').textContent = state.card?.owner_message ?? state.agents[state.activeAgent]?.activity ?? 'The crew is ready for work.';
  $('queue').textContent = state.queue.length ? `${state.queue.length} approvals waiting · ${state.queue.map(a => a.agent).filter(Boolean).join(', ')}` : 'No approvals waiting';
  const card = state.card; $('card').hidden = !card;
  if (card) { $('card').replaceChildren(); $('card').style.setProperty('--tone', tone(card.decision)); text('strong', card.decision === 'HOLD_FOR_APPROVAL' ? 'HELD FOR YOUR APPROVAL' : card.decision === 'ALLOW' ? '✓ ALLOW' : card.decision ?? 'WORK', $('card')); text('span', card.owner_message ?? 'Review action', $('card')).className = 'message'; text('small', `${card.rules?.join(' · ') || 'Event record'} → Inspect`, $('card')); }
  $('bubble').hidden = !state.alert; $('bubble').textContent = state.alert ?? '';
  if (flatMode) flat(); else floor?.update(state, animate);
  if (!$('drawer').hidden) inspect(selected);
  requestDraw();
}
async function chooseView() {
  const reason = $('stage').clientWidth < 600 ? 'Stage narrower than 600 px' : motion.matches ? 'Reduced motion preference' : failed;
  flatMode = !!reason || !floor;
  $('stage').classList.toggle('is-flat', flatMode);
  $('flat').hidden = !flatMode; $('fallback').hidden = !flatMode; $('view').hidden = $('tags').hidden = $('leaders').hidden = flatMode;
  $('fallback').textContent = `${reason || 'Loading 3D'} · 2D still-frame map`;
  if (!reason && !floor && !loading) {
    loading = true;
    try { floor = await createFloor($('view'), $('tags'), $('leaders'), inspect, error => { failed = error; chooseView(); }); }
    catch (error) { failed = ['Pinned three.js download unavailable', 'WebGL unavailable'].includes(error.message) ? error.message : '3D scene unavailable'; $('view').dataset.error = error.stack ?? error.message; }
    finally { loading = false; chooseView(); }
    return;
  }
  if (!flatMode) floor.resize(); refresh();
}
function stop() { playing = false; clearTimeout(timer); timer = null; $('play').textContent = 'Play'; $('play').setAttribute('aria-label', 'Play replay'); }
function schedule() {
  clearTimeout(timer); timer = null; if (document.hidden) return;
  if (playing || (mode === 'live' && liveReady && index < events.length - 1)) timer = setTimeout(() => {
    if (index < events.length - 1) { index++; refresh(!motion.matches); schedule(); } else stop();
  }, 1000 / Number($('speed').value));
}
function setMode(next) { mode = next; for (const name of ['live', 'replay', 'sample']) $(name).setAttribute('aria-pressed', String(name === next)); $('play').disabled = next === 'live'; }
function disconnect() { stream?.close(); stream = null; clearTimeout(historyTimer); liveReady = false; }
function sample() { disconnect(); stop(); setMode('sample'); events = structuredClone(globalThis.FLOOR_SAMPLE ?? []); index = -1; $('connection').textContent = `Sample · ${events.length} events from a real rogue run`; refresh(); }
function replayMode() { disconnect(); stop(); setMode('replay'); $('connection').textContent = `Replay · ${events.length} loaded events`; refresh(); }
function live() {
  if (!token || location.protocol === 'file:') { $('connection').textContent = 'Live needs /floor/?token=<owner token> on the MCP server.'; return; }
  disconnect(); stop(); setMode('live'); events = []; index = -1; seen = new Set(); refresh(); $('connection').textContent = 'Connecting to owner event stream…';
  stream = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  stream.onopen = () => { $('connection').textContent = 'Live · Connected'; clearTimeout(historyTimer); historyTimer = setTimeout(() => { if (!liveReady) { liveReady = true; index = events.length - 1; refresh(); } }, 100); };
  stream.onerror = () => { $('connection').textContent = 'Live disconnected · Retrying; check the server and owner token.'; };
  for (const type of types) stream.addEventListener(type, message => {
    try {
      const e = JSON.parse(message.data), key = e.hash ?? `${e.seq}:${e.type}:${e.id ?? e.task_id}`; if (seen.has(key)) return; seen.add(key); events.push(e);
      if (!liveReady) { clearTimeout(historyTimer); historyTimer = setTimeout(() => { liveReady = true; index = events.length - 1; refresh(); }, 100); }
      else { $('cursor').max = events.length - 1; if (!timer) schedule(); }
    } catch { $('connection').textContent = 'An invalid stream event was ignored.'; }
  });
}
$('sample').onclick = sample; $('replay').onclick = replayMode; $('live').onclick = live;
$('play').onclick = () => { if (playing) stop(); else { if (index >= events.length - 1) { index = -1; refresh(); } playing = true; $('play').textContent = 'Pause'; $('play').setAttribute('aria-label', 'Pause replay'); schedule(); } };
$('speed').onchange = schedule;
$('cursor').oninput = () => { const next = Number($('cursor').value); if (mode === 'live') replayMode(); stop(); index = next; refresh(); };
$('log').onchange = async () => {
  const file = $('log').files[0]; if (!file) return;
  try { const raw = await file.text(); const rows = raw.trim().startsWith('[') ? JSON.parse(raw) : raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); if (!Array.isArray(rows) || !rows.every(e => e && typeof e.type === 'string')) throw new Error('Expected an event array or JSONL log'); replayMode(); events = rows; index = -1; $('connection').textContent = `Replay · ${file.name} · ${rows.length} events`; refresh(); }
  catch (e) { $('connection').textContent = `Could not load log: ${e.message}`; }
  $('log').value = '';
};
new ResizeObserver(chooseView).observe($('stage')); motion.addEventListener('change', chooseView);
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; clearTimeout(timer); timer = null; } else { requestDraw(); schedule(); } });
window.addEventListener('pagehide', disconnect);
sample(); chooseView(); if (token) live();
