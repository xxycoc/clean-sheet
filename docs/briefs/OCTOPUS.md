# OCTOPUS brief: octopus staff in look B

Siang Woo picked look B (Match night) from `docs/looks/index.html`. Now the staff should be octopuses. Build **three octopus character options** inside look B, so he can pick one. Options only, not the final view.

## Make `docs/looks/octopus.html`
- Copy look B's scene, sequence, captions and scoreboard from `docs/looks/index.html` (keep the same 25-second script and messages). Drop looks A and C from this file.
- Switcher with buttons and keys 1/2/3 for three octopus styles:
  - **1 · Chunky toy**: round low-poly head, big eyes, short stubby tentacles, flat bright colours. Cute.
  - **2 · Sleek**: smooth taller mantle, slim curling tentacles, glossy material, small eyes. Smart office worker.
  - **3 · Squishy**: wide jelly-like body with gentle bob/squash, tentacles that wave while walking, a tiny tie or lanyard per agent.
- All four staff (Inbox, Sales, Finance, Marketing) are octopuses in their colour. **The Keeper is an octopus goalkeeper** in gloves on several tentacles, bigger than the staff. The BLOCK save uses tentacles stretching to stop the ball; HOLD wraps the ball in tentacles.
- Tentacles animate (sway idle, ripple while walking, a kick uses one tentacle). Respect prefers-reduced-motion (static BLOCK frame at 16 s).
- Fix two problems from the first pass: room labels overlapped workers and the "Regulated" sub-label was clipped (offset room labels to the back edge of each room and keep agent labels above heads without overlap); the goal and Keeper were too small for a 1920x1080 video (make goal about 1.6x and frame the camera so the goal area is clearly visible).
- Same rules as before: three.js 0.160.0 from the jsDelivr import map only, all geometry in code, no downloaded models or textures, original design that does not imitate any existing game or app. Readable at phone width.
- Touch nothing outside `docs/looks/`. Do not run git.
- Check syntax with `node --check` on an extracted copy of the module.

## Report
Write `docs/looks/octopus-result.md`: two lines per octopus style, what changed for labels and goal size, anything unverified. Under 30 lines.
