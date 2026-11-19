export const STAFF = ['Marketing', 'Sales', 'Finance', 'Ops', 'Support'];
export const LEVELS = ['public', 'internal', 'client-confidential', 'regulated'];
export const COLORS = { public: '#58ce93', internal: '#72b7ef', 'client-confidential': '#f1ba64', regulated: '#f08091' };
// Highest labels in the shipped workspace, including content-detected labels.
export const ZONES = [
  { name: 'Inbox', x: -11, z: 0, w: 3.4, d: 10, level: 'regulated' },
  { name: 'Clients', x: -7.3, z: -3.5, w: 2.9, d: 2.7, level: 'client-confidential' },
  { name: 'Finance', x: -7.3, z: 0, w: 2.9, d: 2.7, level: 'regulated' },
  { name: 'Notes', x: -7.3, z: 3.5, w: 2.9, d: 2.7, level: 'client-confidential' },
  { name: 'Marketing', x: -3.9, z: -3.5, w: 2.9, d: 2.7, level: 'public' },
  { name: 'Admin', x: -3.9, z: 3.5, w: 2.9, d: 2.7, level: 'regulated' },
  { name: 'Staff', x: 1.6, z: 0, w: 7.2, d: 10 },
  { name: 'Keeper', x: 7, z: 0, w: 3.5, d: 10 },
  { name: 'Outside', x: 11, z: 0, w: 3.4, d: 10 },
];
export const home = name => ({ x: [-.9, 1.6, 4.1, .3, 3.1][STAFF.indexOf(name)], z: STAFF.indexOf(name) < 3 ? -2.4 : 3.1 });
const roomFor = file => ZONES.find(z => z.name.toLowerCase() === String(file ?? '').split('/')[0].toLowerCase());
const suspicious = e => e.trust === 'untrusted' || e.observed_file?.header?.trust === 'untrusted' ||
  (String(e.file ?? '').startsWith('inbox/') && /lookalike/i.test(e.file));

/** Inclusive event cursor; -1 is the untouched floor. Rebuilds without mutating inputs. */
export function sceneAt(events, index = events.length - 1) {
  const cursor = Math.min(events.length - 1, Math.max(-1, Number.isFinite(index) ? Math.trunc(index) : -1));
  const s = { index: cursor, event: null, activeAgent: null, agents: Object.fromEntries(STAFF.map(name => [name, { name, ...home(name), activity: 'At desk', decision: null }])),
    rooms: ZONES.map(z => ({ ...z })), actions: Object.create(null), queue: [], score: { saves: 0, held: 0, conceded: 0 }, card: null, ball: null, villain: false, alert: null, keeper: 'ready' };
  const tasks = Object.create(null), hostile = new Set();
  for (const e of events.slice(0, cursor + 1)) {
    s.event = e; s.alert = null;
    const name = e.agent ?? tasks[e.task_id]?.agent ?? s.actions[e.id]?.agent;
    const agent = Object.hasOwn(s.agents, name) ? s.agents[name] : null;
    s.activeAgent = agent ? name : null;
    if (e.type === 'task.started') {
      tasks[e.task_id] = { agent: name };
      if (agent) Object.assign(agent, { x: 1, z: 0, activity: e.instruction ?? 'Starting task', taskId: e.task_id });
      s.card = null; s.ball = null; s.keeper = 'ready';
    }
    if (e.type === 'file.read') {
      const room = roomFor(e.file);
      if (agent && room) Object.assign(agent, { x: room.x + .5, z: room.z + .3, activity: `Reading ${e.file}` });
      if (room && LEVELS.includes(e.level)) {
        const r = s.rooms.find(r => r.name === room.name);
        if (LEVELS.indexOf(e.level) > LEVELS.indexOf(r.level)) r.level = e.level;
      }
      if (e.in_scope === false) s.alert = `Out of scope: ${e.file}`;
      if (suspicious(e)) hostile.add(e.task_id);
      s.villain = hostile.size > 0;
      s.card = { ...e, owner_message: e.owner_message ?? (e.in_scope === false ? `Out of scope: ${e.file}` : `Reading ${e.file}`) };
      if (agent) agent.decision = s.card;
    }
    if (e.type === 'directory.listed' && agent) agent.activity = `Listing ${e.path || 'workspace'}`;
    if (e.type === 'action.proposed') {
      const room = roomFor(e.args?.instruction_source);
      if (room?.name === 'Inbox' && /lookalike/i.test(e.args.instruction_source)) hostile.add(e.task_id);
      s.actions[e.id] = { ...e, status: 'proposed', decision: null };
      if (agent) Object.assign(agent, { x: 4.5, z: 0, activity: String(e.tool ?? 'action').replaceAll('_', ' ') });
      s.ball = { id: e.id, agent: name, phase: 'flight', x: 5.5, y: 1, z: 0 };
      s.card = { ...e, decision: 'PROPOSED', owner_message: `Reviewing ${String(e.tool ?? 'action').replaceAll('_', ' ')}` };
      s.keeper = 'ready'; s.villain = hostile.size > 0;
    }
    if (e.type === 'keeper.decision') {
      const action = s.actions[e.id] ??= { id: e.id, agent: name, task_id: e.task_id };
      action.decision = e;
      // A refused release emits revalidation but leaves the channel queue pending.
      if (!e.revalidation) action.status = e.decision === 'HOLD_FOR_APPROVAL' ? 'pending' : e.decision;
      s.card = { ...e }; if (agent) agent.decision = s.card;
      s.keeper = e.decision === 'BLOCK' ? 'save' : e.decision === 'HOLD_FOR_APPROVAL' ? 'hold' : 'allow';
      s.ball = { id: e.id, agent: name, phase: s.keeper, x: s.keeper === 'allow' ? 10.5 : 6.7, y: s.keeper === 'save' ? .45 : 1, z: s.keeper === 'save' ? 1.2 : .7 };
      if (e.decision === 'BLOCK') hostile.delete(e.task_id);
      s.villain = hostile.size > 0;
    }
    if (e.type === 'approval.queued') {
      const a = s.actions[e.id] ??= { id: e.id, agent: e.entry?.task?.agent, decision: e.entry?.decision };
      a.status = 'pending';
    }
    if (e.type === 'owner.decision') {
      const a = s.actions[e.id];
      if (a) {
        a.status = e.released ? 'released' : 'rejected'; a.ownerReleased = e.released;
        s.card = { ...a.decision, owner: e, owner_message: `${e.released ? 'Owner approved release.' : 'Owner rejected release.'} ${a.decision?.owner_message ?? ''}` };
        if (Object.hasOwn(s.agents, a.agent)) s.agents[a.agent].decision = s.card;
      }
      s.keeper = e.released ? 'allow' : 'hold';
      s.ball = { id: e.id, phase: e.released ? 'allow' : 'rejected', ownerReleased: e.released, x: e.released ? 10.5 : 6.7, y: 1, z: .7 };
    }
    if (e.type === 'action.executed' || e.type === 'action.failed') {
      const a = s.actions[e.id] ??= { id: e.id, agent: name };
      a.status = e.type === 'action.failed' ? 'failed' : 'executed'; a.result = e.result;
      if (e.type === 'action.executed') s.ball = { id: e.id, phase: 'outside', ownerReleased: a.ownerReleased, x: 11.2, y: .35, z: .7 };
      else { s.ball = null; s.card = { ...a?.decision, decision: 'FAILED', owner_message: e.message ?? 'Execution failed.' }; }
    }
    if (e.type === 'task.ended' && agent && agent.taskId === e.task_id) Object.assign(agent, { ...home(name), activity: 'At desk' });
    if (e.type === 'briefing.ready') s.card = { ...e, decision: 'BRIEFING', owner_message: `Briefing ready for ${e.date ?? 'today'}`, evidence: [{ claim: 'Counts', value: e.counts }] };
  }
  const actions = Object.values(s.actions);
  s.queue = actions.filter(a => a.status === 'pending').map(a => ({ id: a.id, agent: a.agent, decision: a.decision }));
  // Bookkeeping and a new task must not make a pending catch disappear.
  if ((s.keeper === 'ready' || s.event?.revalidation) && s.queue.length) {
    const held = s.queue.at(-1);
    s.keeper = 'hold'; s.ball = { id: held.id, agent: held.agent, phase: 'hold', x: 6.32, y: .87, z: 0 };
  }
  s.score.saves = actions.filter(a => a.decision?.decision === 'BLOCK').length;
  s.score.held = s.queue.length;
  // A permitted action is not a conceded goal. Count only execution without authorization.
  s.score.conceded = actions.filter(a => a.status === 'executed' && a.decision?.decision !== 'ALLOW' && a.ownerReleased !== true).length;
  return s;
}

export function placeOverlay(anchor, size, bounds, occupied) {
  const [w, h] = size, gap = 12;
  const offsets = [[20, -h - 20], [-w - 20, -h - 20], [20, 24], [-w - 20, 24], [-w / 2, -h - 80], [-w / 2, 80]];
  for (const [dx, dy] of offsets) {
    const r = { x: anchor.x + dx, y: anchor.y + dy, w, h };
    if (r.x < gap || r.y < gap || r.x + w > bounds.w - gap || r.y + h > bounds.h - gap) continue;
    if (!occupied.some(b => r.x < b.x + b.w + gap && r.x + w + gap > b.x && r.y < b.y + b.h + gap && r.y + h + gap > b.y)) return { ...r, docked: false };
  }
  return { x: Math.max(gap, bounds.w - w - gap), y: gap, w, h, docked: true };
}

export function eventDelay(event, speed = 2) {
  if (['keeper.decision', 'owner.decision'].includes(event?.type)) return 2500;
  if (['directory.listed', 'task.ended'].includes(event?.type)) return 60;
  return 1000 / speed;
}

// Resolve in stable cast order, including shared destinations and stationary staff.
export function separateWalkers(points, desks) {
  const spacing = 1.7, radius = .65;
  for (let pass = 0; pass < 80; pass++) {
    let correction = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      for (let j = 0; j < i; j++) {
        const q = points[j], dx = p.x - q.x, dz = p.z - q.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= spacing) continue;
        const push = (spacing - distance) / 2;
        // A shared position gets a deterministic sideways lane.
        const nx = distance > .0001 ? dx / distance : 1, nz = distance > .0001 ? dz / distance : 0;
        p.x += nx * push; p.z += nz * push; q.x -= nx * push; q.z -= nz * push;
        correction = Math.max(correction, push);
      }
    }
    for (const p of points) {
      const clear = (x, z) => desks.every(d => Math.abs(x - d.x) >= .7 + radius - 1e-9 || Math.abs(z - d.z) >= .35 + radius - 1e-9);
      if (clear(p.x, p.z)) continue;
      // Test the union of desk footprints: clearing one desk must not enter its neighbour.
      const xs = [p.x, ...desks.flatMap(d => [d.x - .7 - radius, d.x + .7 + radius])];
      const zs = [p.z, ...desks.flatMap(d => [d.z - .35 - radius, d.z + .35 + radius])];
      let best, distance = Infinity;
      for (const x of xs) for (const z of zs) {
        const delta = Math.hypot(x - p.x, z - p.z);
        if (delta < distance && clear(x, z)) { best = { x, z }; distance = delta; }
      }
      Object.assign(p, best); correction = Math.max(correction, distance);
    }
    if (correction < .0001) break;
  }
  return points;
}
