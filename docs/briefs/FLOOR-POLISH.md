# FLOOR-POLISH brief

The 3D floor (`public/floor/`) works. The owner reviewed a 1920x1080 render: `docs/floor-check/owner-review-1.png`. Fix what it shows, then make it ready to publish as a static page on GitHub Pages.

## Fix
1. **Staff are crammed in one column.** All five octopuses stand on top of each other in the "Staff" zone and their name tags overlap. Give each its own desk spread across a wider staff area (for example two rows: 3 + 2), with clear space between characters, so every octopus, prop and tag reads at 1920x1080 and in a 1280x720 crop.
2. **Remove the duplicate tags.** "Staff / AI staff" and "Keeper / Rules as code" zone tags sit right above the agent tags; keep zone tags at the back edge of each zone and never let any tag overlap another (use the existing clear-offset placement for agent tags too).
3. **Autoplay the sample.** When opened without a server or token, start Sample playback automatically at 1x after 1 second, loop at the end with a 3-second pause on the final scoreboard. Respect prefers-reduced-motion (no autoplay; show the final state).
4. **Empty rooms feel dead.** Add one or two small props per folder room in the same block style (papers on a desk, a lamp, a plant, a box), still from primitives.
5. **Frame for video.** Camera a little closer so the goal, Keeper and staff fill more of the frame; the whole floor must still fit.
6. **Show the state.** Keep the scoreboard updating (Saves / Held / Conceded) and make the current decision card prominent (larger, coloured by decision, with the owner message).

## Ready for GitHub Pages
- The page must work from `https://xxycoc.github.io/clean-sheet/floor/` (served from the repo's `public/` folder at `/clean-sheet/`): all asset paths relative, no absolute `/floor/` or `/api/` paths in static mode.
- Add `public/index.html` that redirects to `floor/` and has a one-line description with a link.
- Live mode stays available with `?server=<https url>&token=<owner token>` (use that base URL for `/api/events`); default is Sample.
- Add a small footer credit line: "Clean Sheet · QwenWork OPC Hackathon 2026 · All data fictional (AvePoint starter kit)".

## Rules
- Same as before: three.js 0.160.0 via the jsDelivr import map only; all geometry in code; no downloads; do not change `src/keeper/`; `npm test` passes (rebuild the bundle with `node scripts/floor-build.js` so the bundle test passes); scores stay Kit 15/15, Extra 6/6, Normal 42/42, 0 false alarms. Do not run git.

## Report
`docs/FLOOR-POLISH-result.md`, under 30 lines.
