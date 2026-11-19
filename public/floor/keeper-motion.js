// Coordinates shared by rendering and collision tests; pitch is negative X.
export const KEEPER_GOAL = { x: 8.3, halfWidth: 1.6, height: 2.9, ballRadius: .23 };
export const KEEPER_YAW = .55;
export function keeperToWorld([x,y,z]) { const c=Math.cos(KEEPER_YAW), s=Math.sin(KEEPER_YAW); return [8.3+(x-8.3)*c+z*s,y,-(x-8.3)*s+z*c]; }
export function worldToKeeper([x,y,z]) { const c=Math.cos(KEEPER_YAW), s=Math.sin(KEEPER_YAW); return [8.3+(x-8.3)*c-z*s,y,(x-8.3)*s+z*c]; }
export const keeperEase = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const mixPoint = (a, b, t) => a.map((v, i) => v + (b[i] - v) * keeperEase(t));
export function keeperMotion(kind, seconds, origin = worldToKeeper([4.4, .3, 0]), reduced = false) {
  const duration = kind === 'save' ? 1.6 : kind === 'hold' ? 1.4 : 1.2;
  const t = reduced ? duration : Math.max(0, seconds);
  const approach = keeperEase((t - .25) / .35);
  const recover = keeperEase((t - .85) / .5);
  const dive = kind === 'save' ? approach * (1 - recover) : 0;
  const catchAmount = kind === 'hold' ? keeperEase((t - .6) / .45) : ['release','reject'].includes(kind) ? 1 - keeperEase(t / .45) : 0;
  const aside = ['allow', 'release'].includes(kind) ? keeperEase(t / .45) : 0;
  const root = [7.1, .02, dive * .12 - aside * .55];
  const limbs = Array.from({ length: 8 }, (_, j) => {
    const a = j * Math.PI / 4;
    return j % 2 ? [Math.cos(a) * .65, .22, Math.sin(a) * .65] : [Math.cos(a) * .65, .75 + Math.sin(a) * .15, .45];
  });
  if (kind === 'hold') for (const j of [0,2,4,6]) {
    const a = j * Math.PI / 4;
    limbs[j] = mixPoint(limbs[j], [Math.cos(a)*.22,.95+Math.sin(a)*.22,.45], approach);
  }
  limbs[0] = mixPoint(limbs[0], [.95, .95, .7], dive);
  limbs[4] = mixPoint(limbs[4], [-.5, .55, -.2], dive);
  for (const j of [0, 2, 4, 6]) {
    const a = j * Math.PI / 4;
    limbs[j] = mixPoint(limbs[j], [Math.cos(a) * .22, .85 + Math.sin(a) * .22, .78], catchAmount);
  }
  limbs[0] = mixPoint(limbs[0], [.65, 1.2, .4], aside);
  const contact = [6.4, .97, 1.07], chest = [6.32, .87, 0];
  let ball = origin.slice();
  if (kind === 'save' || kind === 'hold') {
    const target = kind === 'save' ? contact : [6.65, .97, 0];
    ball = mixPoint(origin, target, (t - .25) / .35);
    ball[1] += Math.sin(Math.PI * approach) * .55;
    if (t >= .6) {
      if (kind === 'hold') ball = mixPoint(target, chest, (t - .6) / .45);
      else {
        const q = keeperEase((t - .6) / 1);
        ball = mixPoint(contact, [4.6, .23, 1.07], (t - .6) / 1);
        // Two landing arcs, then a grounded roll; every boundary has zero velocity.
        ball[1] = q < .4 ? .23 + .74 * (1 - keeperEase(q / .4)) + .35 * Math.sin(Math.PI * q / .4) ** 2
          : q < .8 ? .23 + .32 * Math.sin(Math.PI * (q - .4) / .4) ** 2 : .23;
      }
    }
  } else if (kind === 'reject') {
    ball = mixPoint(chest, [5.3, .23, .3], t / duration);
  } else if (kind === 'allow' || kind === 'release') {
    const start = kind === 'release' ? chest : origin;
    ball = t < .65 ? mixPoint(start, [8.3, .23, .35], t / .65) : mixPoint([8.3, .23, .35], worldToKeeper([11.2, .23, -2.3]), (t - .65) / .55);
  }
  return { root, limbs, ball, lean: -dive * Math.PI / 5,
    squash: 1 - .08 * Math.sin(Math.PI * keeperEase(t / .25)) - .09 * Math.sin(Math.PI * keeperEase((t - .6) / .16)),
    glow: catchAmount, impact: kind === 'save' && t >= .6 ? 1 - keeperEase((t - .6) / .25) : 0,
    card: kind === 'save' ? keeperEase((t - .6) / .15) : 0,
    tick: aside * keeperEase((t - .9) / .3), netOpen: aside,
    trail: t > .25 && t < (kind === 'save' ? 1.5 : 1.2), active: t < duration, duration };
}
