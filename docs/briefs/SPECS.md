# SPECS brief: a fourth octopus style from Siang Woo's reference

Reference image: `docs/looks/ref/octopus-reference.png` (look at it first). It shows a cute octopus: a smooth, glossy, rounded pastel-lilac head, very large round glasses with thick cyan frames, big dark eyes behind the lenses, a small smile, and eight short tentacles that curl up at the tips with lighter sucker dots underneath. Soft studio lighting, toy-like proportions (head about 60% of height).

Add style **4 · Specs** to `docs/looks/octopus.html` (button and key 4), next to the existing three. Keep everything else in that file working.

## Character
- Head: smooth sphere slightly squashed (MeshStandardMaterial or MeshPhysicalMaterial with clearcoat, low roughness, pastel colour). Not faceted: use enough segments to look round.
- Eyes: large dark glossy spheres with a small white highlight sphere each. Small curved smile.
- Glasses: two thick torus rims plus a bridge and short arms, slightly transparent lens discs. This is the signature: make them big, as in the reference.
- Tentacles: eight tapered tubes (TubeGeometry along a CatmullRom curve) that rest outward then curl upward at the tips, with small lighter sucker discs on the underside near the tips. Animate by bending the curve (sway idle, ripple walking, one tentacle kicks).
- Personality like the reference and like the owner's duck mascots: each staff octopus keeps the glasses and gets one role prop and its own pastel colour:
  - Inbox (pastel blue): a small envelope held in one tentacle.
  - Sales (pastel mint): a tiny briefcase.
  - Finance (pastel coral): a calculator or coin stack.
  - Marketing (pastel lilac, closest to the reference): a small megaphone.
  - Keeper (pastel yellow, 1.5x size): goalkeeper gloves on four tentacles and a sporty cap; the save and the hold work as in the other styles.
- Original design built from primitives in code: no downloaded models, textures or fonts; do not copy any existing character.

## Rules
- Same 25-second script, captions, scoreboard and label placement as the other styles; reduced motion shows the static BLOCK frame.
- three.js 0.160.0 via the existing import map only.
- Touch only `docs/looks/`. Do not run git.
- Check with `node --check` on an extracted copy of the module. If you can render headless, compare your Specs octopus to the reference image and adjust proportions.

## Report
Append a "4 · Specs" section to `docs/looks/octopus-result.md`: what you built, how close it is to the reference, anything unverified. Under 15 lines.
