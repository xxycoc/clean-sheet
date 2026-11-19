# KEEPER-ANIM brief: make the save, the catch and the pass read clearly

Owner's screenshot of the current BLOCK save: `docs/process/review/keeper-save-before.png`. Problems:
1. The Keeper dives from inside the goal frame, so a goalpost passes straight through its body.
2. The whole body rolls about 90 degrees, so it reads as falling over, not diving.
3. The ball ends up loose behind the goal, which looks like a goal conceded.
4. Two Keeper tags overlap ("Keeper" and the zone tag "Keeper / Rules as code").

Rework the Keeper animations in `public/floor/` (scene and characters). Timings are for the 2.5 s decision hold already in place.

## Staging
- The Keeper stands on the goal line, a little in front of the posts (towards the pitch), centred in the goal mouth. It never intersects the posts, crossbar or net: clamp its dive so the body stays inside the mouth and in front of the frame.
- Camera stays as it is; the goal mouth should face the camera side enough that the save is visible.
- Only one Keeper tag: drop the agent tag when the zone tag already names the Keeper, or merge them into "Keeper · rules as code".

## BLOCK (save): about 1.6 s, then hold the end pose
1. Ready (0.25 s): small crouch, tentacles spread, gloves up, eyes on the ball.
2. Ball flight: the ball arcs from the kicker towards the goal mouth on a visible curve with a faint trail.
3. Dive (0.35 s): the body leans at most 35 to 45 degrees towards the ball and slides sideways; the near tentacles stretch out (lengthen) towards the ball; far tentacles trail. Squash slightly on take-off.
4. Contact: glove meets ball in front of the goal line. Small impact burst (a ring and a few spheres that fade), a short squash on the Keeper, and the ball is parried back out onto the pitch, bouncing twice and rolling to a stop well in front of the goal. Red card appears.
5. Recover (0.5 s): Keeper pops back upright to the ready pose, maybe a tiny celebratory fist pump with one glove.

## HOLD (catch): about 1.4 s
Same approach, but the Keeper catches the ball against its chest; four tentacles wrap around it; the ball glows amber softly while held; the Keeper stays in the goal holding it until an owner decision event (release: ball rolls out to Outside; reject: Keeper drops it back onto the pitch).

## ALLOW (pass): about 1.2 s
The Keeper steps aside and gestures "go" with one glove; the ball passes through the goal mouth (the net opens or the ball passes beside the goal, whichever reads better) and rolls to the Outside door with a short green trail and a green tick.

## Quality bar
- No clipping of Keeper, ball or tentacles through the goal frame or the floor at any frame. Add a unit test on the pure motion functions (sample the Keeper and ball positions over each animation and assert they stay inside the goal mouth / in front of the posts / above the floor).
- Easing on every move (no linear snaps). Reduced motion: show the end pose only.
- Keep everything else; rebuild the bundle (`node scripts/floor-build.js`); `npm test` passes; scores unchanged (Kit 15/15, Extra 6/6, Normal 45/45). three.js 0.160.0 via the import map. Do not run git.
- If the CDN is blocked in your sandbox and a local three.js build is available on this machine, you may use it for headless visual checks only; never ship it. Render BLOCK, HOLD and ALLOW frames at contact time and compare against the problems above.

Report in `docs/process/reports/KEEPER-ANIM-result.md`, under 25 lines.
