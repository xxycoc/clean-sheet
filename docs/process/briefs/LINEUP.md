# LINEUP brief: Clean Sheet octopus crew line-up

Siang Woo designs characters the way he did his duck crew: each role recognisable by silhouette first, then one prop. Build a **line-up page** so he can approve the cast before it goes on the floor. Reference for the base look: `docs/looks/ref/octopus-reference.png` and style "4 · Specs" in `docs/looks/octopus.html` (reuse its head, eyes, glasses and curled-tentacle code; improve it).

## Make `docs/looks/lineup.html`
- Characters stand side by side on a simple light-grey studio floor with soft studio lighting (brighter than match night so pastels pop), large on screen, each slowly turning (about 20 s per turn), name tag and one-line personality under each.
- Click or tap a character (or keys 1 to 8) to focus it: it centres, scales up and plays its idle and its signature action on loop. Esc returns to the line-up.
- Reduced motion: no turning, front three-quarter view, signature action shown as a still pose.

## Colour code
- AI staff (QwenWork agents): all pastel lilac bodies (#c9b6f2 range), all wear the big cyan specs from the reference. Their props and headwear carry the role colour.
- Keeper (rules as code, not AI): no specs. Build **two variants side by side** labelled "Keeper A · silver (code colour)" with a silver-white body, and "Keeper B · yellow" with a pastel yellow body. Both wear a green goalkeeper jersey (#2BD47D) with a big white "1", a flat cap with a proper peak, gloves on four tentacles, about 1.4x staff size.

## The cast (one line each; silhouette first)
1. **Marketing**: over-excited. Star-shaped sunglasses pushed up on top of its specs, tentacles flung wide. Holds a megaphone and a phone on a selfie stick. Signature: strikes a selfie pose, then shouts into the megaphone.
2. **Sales**: eager closer. Slicked-back head tuft, loud striped tie, one tentacle always out for a handshake. Briefcase and a small "DEAL" sign. Signature: offers a handshake, flips the DEAL sign.
3. **Finance**: precise, a bit gullible. Green visor, sleeve garters on two tentacles. Calculator and a short coin stack. Signature: taps the calculator, coins bounce.
4. **Ops**: neat freak. Yellow hard hat. Broom and a small recycling bin. Signature: sweeps, then tosses a paper into the bin.
5. **Support**: friendly but nosy. Headset with a mic. Steaming coffee mug (simple rising puff spheres). Signature: leans sideways peeking, sips coffee.
6. **Keeper A** and 7. **Keeper B** as above. Signature: dives sideways with tentacles stretched, then catches and wraps a ball.
8. **Optional extras**, shown at the right end under a divider labelled "Optional":
   - **Villain**: a grey-green squid (longer pointed mantle, ten arms) wearing an obviously fake pair of specs with a moustache attached. Signature: peeks in, twirls the moustache.
   - **Mascot**: a tiny baby octopus ball-kid (half staff size, pastel peach, backwards cap, no specs). Signature: runs, picks up a ball, holds it up.
   (Keys 8 and 9 for these two; adjust the 1 to 8 range accordingly.)

## Rules
- All geometry in code from primitives (spheres, tubes along curves, boxes, tori, cylinders); smooth shading for bodies. No downloaded models, textures or fonts. Original designs; do not copy any existing character (no Squidward, no anime octopus).
- three.js 0.160.0 via the jsDelivr import map only.
- Readable at phone width (line-up scrolls horizontally on phones or wraps into two rows) and in a 1920x1080 frame.
- Touch only `docs/looks/`. Do not run git. Check with `node --check` on an extracted copy of the module; render headless if you can and fix anything unreadable.

## Report
`docs/looks/lineup-result.md`: one line per character on how its silhouette reads, anything unverified. Under 25 lines.
