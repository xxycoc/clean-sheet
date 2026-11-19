import test from 'node:test';
import assert from 'node:assert/strict';
import { keeperMotion, KEEPER_GOAL as goal } from '../public/floor/keeper-motion.js';
for (const kind of ['save', 'hold', 'allow', 'release', 'reject']) {
  test(`${kind}: sampled motion clears the floor and goal frame`, () => {
    for (let i = 0; i <= 2500; i++) {
      const m = keeperMotion(kind, i / 1000);
      assert.ok(Math.abs(m.lean) <= Math.PI / 4);
      assert.ok(m.root[0] + .95 < goal.x - .07);
      assert.ok(Math.abs(m.root[2]) + .95 < goal.halfWidth - .07);
      assert.ok(m.root[1] + 1.9 < goal.height - .06);
      for (const [x,y,z] of m.limbs) {
        assert.ok(m.root[0] - z + .18 < goal.x - .07);
        assert.ok(Math.abs(m.root[2] + x) + .18 < goal.halfWidth - .07);
        assert.ok(m.root[1] + y - .18 >= 0);
      }
      assert.ok(m.ball[1] >= goal.ballRadius - 1e-9);
      if (Math.abs(m.ball[0] - goal.x) < goal.ballRadius + .07) {
        assert.ok(Math.abs(m.ball[2]) + goal.ballRadius < goal.halfWidth - .07);
        assert.ok(m.ball[1] + goal.ballRadius < goal.height - .06);
      }
      if (['save','hold','reject'].includes(kind)) assert.ok(m.ball[0] + goal.ballRadius < goal.x);
    }
  });
}
test('contact aligns with glove; save finishes on pitch; catch persists', () => {
  const m = keeperMotion('save', .6), [x,y,z] = m.limbs[0];
  assert.ok(Math.hypot(...m.ball.map((v,i)=>v-[m.root[0]-z,m.root[1]+y,m.root[2]+x][i])) < 1e-9);
  assert.deepEqual(keeperMotion('save', 1.6).ball, [4.6,.23,1.07]);
  assert.equal(Math.abs(keeperMotion('save', 1.6).lean), 0);
  const held = keeperMotion('hold', 1.4).ball;
  assert.deepEqual(keeperMotion('hold', 100).ball, held);
  for (const kind of ['release','reject']) assert.deepEqual(keeperMotion(kind, 0).ball, held);
});
test('reduced motion is end pose and ball trajectories are continuous', () => {
  for (const kind of ['save','hold','allow','release','reject']) {
    assert.deepEqual(keeperMotion(kind, 0, undefined, true), keeperMotion(kind, 10));
    for (const t of [.25,.6,.65,.85,1.05,1.2,1.4,1.6]) {
      const a = keeperMotion(kind,t-1e-6), b = keeperMotion(kind,t+1e-6);
      assert.ok(Math.hypot(...a.ball.map((v,i)=>v-b.ball[i])) < .0001, `${kind} at ${t}`);
    }
  }
});

test('pending catch survives task/bookkeeping events and resolves only on owner decision', async () => {
  const {sceneAt} = await import('../public/floor/state.js');
  const events = [{type:'action.proposed',id:'a',agent:'Finance'}, {type:'keeper.decision',id:'a',decision:'HOLD_FOR_APPROVAL'}, {type:'approval.queued',id:'a'}, {type:'task.started',task_id:'b',agent:'Sales'}];
  assert.equal(sceneAt(events).keeper, 'hold');
  assert.equal(sceneAt(events).ball.id, 'a');
  for (const released of [true,false]) {
    const s=sceneAt([...events,{type:'owner.decision',id:'a',released}]);
    assert.equal(s.ball.phase,released?'allow':'rejected');
    assert.equal(s.queue.length,0);
  }
});
