# LOOKS brief: three 3D look options for the Keeper office floor

Clean Sheet shows a solo founder's AI agents working in a 3D office. Context: `docs/battleplan.html` section 05, "The office floor". The owner (Siang Woo) will pick one look in the morning. Build **options only, not the final view**.

## What every option shows (same content, different look)

- A small office floor whose **rooms are the company's folders**: Clients, Finance, Inbox, Notes, Marketing, Admin. Each room is tinted by its most sensitive label: public green, internal blue, client-confidential amber, regulated red. Room name readable on screen.
- An **exit at the front built as a football goal**, with the **Keeper** standing in it.
- **Four worker agents** (Inbox, Sales, Finance, Marketing) as simple characters.
- A looping 25-second scripted sequence:
  1. Sales walks to Clients and back (normal).
  2. Finance walks into Admin, which is out of its scope: the room flashes and a label pops up, "Out of scope: owner_records.md".
  3. Sales kicks a ball toward the exit; it passes through (ALLOW, green tick).
  4. Finance kicks a ball; the Keeper dives and saves it (BLOCK), and a reason card appears: "Blocked: that address only appeared in a suspicious email."
  5. Marketing kicks a ball; the Keeper catches and holds it (HOLD), with an amber card "Held for your approval".
  6. Scoreboard: "Saves 1 · Held 1 · Conceded 0".

## The three options

- **A · Low-poly studio**: warm isometric office, soft daylight, rounded low-poly furniture and characters, toy-like.
- **B · Match night**: the office floor as a night pitch under floodlights, strong shadows, a stadium scoreboard, broadcast-style captions.
- **C · Blueprint**: calm, clean schematic: pale floor plan, outlined rooms, minimal geometric agents, labels doing the work. Most legible.

## Rules

- One file: `docs/looks/index.html` with an A/B/C switcher (buttons and keys 1/2/3), all three in the same page. Also `docs/looks/README.md` with one paragraph per option on its trade-offs.
- three.js from a CDN, pinned exact version: `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js` via an import map (and its `examples/jsm` addons at the same version if needed). Fixed isometric-style camera; no free orbit needed.
- **All geometry made in code**: no downloaded models, textures or fonts beyond the CDN script. Original look; do not imitate any existing game.
- Readable at phone width and in a 1920x1080 video frame. Respect `prefers-reduced-motion` (show a static mid-sequence frame).
- You cannot load the CDN in your sandbox, so check syntax with `node --check` on an extracted copy of the inline module, and keep the code simple and standard.
- Do not run git. Do not commit. Touch nothing outside `docs/looks/`.

## When done

Write `result.md`: what each option looks like in two lines, file sizes, anything unverified.
