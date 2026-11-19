import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sceneAt, separateWalkers, eventDelay, placeOverlay, STAFF, ZONES, home } from '../public/floor/state.js';

test('decision dwell is real time at every speed; bookkeeping advances quickly', () => {
  for (const speed of [1, 2, 4]) {
    for (const type of ['keeper.decision', 'owner.decision']) assert.equal(eventDelay({ type }, speed), 2500);
    for (const type of ['directory.listed', 'task.ended']) assert.equal(eventDelay({ type }, speed), 60);
    assert.equal(eventDelay({ type: 'file.read' }, speed), 1000 / speed);
  }
});

test('fully obstructed action docks at the fixed top-right origin', () => {
  assert.deepEqual(placeOverlay({ x: 500, y: 400 }, [370, 180], { w: 1000, h: 700 },
    [{ x: 0, y: 220, w: 1000, h: 480 }]), { x: 618, y: 12, w: 370, h: 180, docked: true });
});

test('all sample transitions maintain body and desk clearance, including intermediate frames', () => {
  const sample = JSON.parse(readFileSync(new URL('../public/floor/sample-events.json', import.meta.url)));
  const desks = ZONES.filter(z => z.level && z.name !== 'Inbox').map(z => ({ x: z.x + .55, z: z.z + .35 }))
    .concat(STAFF.map(n => ({ x: home(n).x, z: home(n).z - .85 })), [{ x: -10, z: 1 }]);
  let from = STAFF.map(home);
  for (let i = 0; i < sample.length; i++) {
    const state = sceneAt(sample, i);
    let points;
    for (let frame = 0; frame <= 20; frame++) {
      const t = frame / 20, eased = t * t * (3 - 2 * t);
      points = separateWalkers(STAFF.map((n, j) => ({
        x: from[j].x + (state.agents[n].x - from[j].x) * eased,
        z: from[j].z + (state.agents[n].z - from[j].z) * eased,
      })), desks);
      for (let j = 0; j < points.length; j++) {
        const p = points[j], context = `event ${i}, frame ${frame}, ${STAFF[j]}`;
        for (let k = 0; k < j; k++) assert.ok(Math.hypot(p.x - points[k].x, p.z - points[k].z) >= 1.699, context);
        for (const d of desks) assert.ok(Math.abs(p.x - d.x) >= 1.349 || Math.abs(p.z - d.z) >= .999, context);
      }
    }
    from = points;
  }
  const shared = separateWalkers(STAFF.map(() => ({ x: 0, z: 0 })), desks);
  for (let i = 0; i < shared.length; i++) for (let j = 0; j < i; j++)
    assert.ok(Math.hypot(shared[i].x - shared[j].x, shared[i].z - shared[j].z) >= 1.699);
});
