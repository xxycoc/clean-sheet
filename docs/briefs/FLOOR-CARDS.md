# FLOOR-CARDS brief

Owner review of the polished floor at 1920x1080: `docs/floor-check/owner-review-2.png`. Fix these in `public/floor/` only.

1. **The decision card covers the Keeper.** The Keeper and the goal are the star of every decision. Treat the Keeper, the goal mouth, the ball in flight and the acting agent as obstacles in the card placement (project their 3D bounds to screen boxes and add them to the obstacle list). If no clear spot exists near the action, dock the card in a fixed panel at the top-right of the stage, never over the goal.
2. **Characters overlap while walking.** In the reference frame Ops stands inside Finance. Keep a minimum spacing between walking characters (simple separation: offset a walker sideways when another is within about one body width) and between a walker and desks.
3. **Sample pace.** 238 events at about one per second takes four minutes. Default the sample to 2x, skip pure bookkeeping events (directory listings, task end) quickly, and give the decision moments (keeper decisions, owner decisions) the time: hold each ALLOW/HOLD/BLOCK for about 2.5 seconds of real time so the dive or catch and the card read.
4. Keep everything else; keep tests passing, rebuild the bundle with `node scripts/floor-build.js`; scores stay Kit 15/15, Extra 6/6, Normal 42/42. three.js stays 0.160.0 from the import map. Do not run git.

Report in `docs/FLOOR-CARDS-result.md`, under 20 lines.
