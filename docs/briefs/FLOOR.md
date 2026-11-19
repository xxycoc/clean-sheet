# FLOOR brief: the live 3D office floor

Clean Sheet watches a one-person company's AI staff. Every action goes through our MCP tool server (`src/mcp/`), the Keeper engine (`src/keeper/`) decides ALLOW / HOLD / BLOCK, and events stream on `GET /api/events` (SSE, owner token via `?token=`). Build the floor that shows this live, as octopuses in a 3D office. Read first: `docs/looks/lineup.html` (approved cast), `docs/looks/octopus.html` (look B "Match night" scene, style 4), `src/mcp/channel.js` and `src/mcp/http.js` (the real event names and payloads), and section 08 of `docs/battleplan.html` (event contract and floor reactions).

## Approved cast (owner decisions)
- Five AI staff: Marketing, Sales, Finance, Ops, Support, exactly as in `lineup.html` (lilac bodies, cyan specs, their headwear and props). These are the agent names the engine uses.
- **Keeper A, silver-white** (rules as code). Fix: real goalkeeper gloves with a thumb and finger shapes (not round balls), a cap with a clear peak (not a beret), the green jersey with a white "1" visible from the front. About 1.4x staff.
- **Villain: yes.** The grey-green squid in fake specs and moustache appears at the Inbox window when an untrusted or lookalike inbound email is read or used (S6), and slinks off when the Keeper blocks it.
- **Mascot: no.** Do not include it.

## Design approach (follow this pattern)
1. **Zones left to right in work-flow order:** Inbox (mail desk with window) → the folder rooms Clients, Finance, Notes, Marketing, Admin (each tinted by its highest label: public green, internal blue, client-confidential amber, regulated red; text label too) → staff desks → the Keeper's goal → Outside (an exit door with Outbox, Uploads and Supplier signs). Zones are translucent floor mats with brighter borders.
2. **Props from primitives:** desks, chairs, plants, filing cabinet, wall clock, all small helper functions (box/cylinder/sphere with flat-shaded materials); characters stay smooth-shaded.
3. **Fixed three-quarter orthographic camera** that fits the whole floor at any aspect, framed closer than `octopus.html` so characters and props read in a 1920x1080 video. No free orbit. One shadow light plus a hemisphere light; match-night mood but bright enough that pastels pop.
4. **Data to scene, pure:** `public/floor/state.js` exports `sceneAt(events, index)` that derives everything (who is where, which ball is in flight, queue counts, scoreboard Saves/Held/Conceded, current decision card) from the event list alone, so scrubbing backwards rebuilds the same scene. No DOM or three.js in this file. Unit test it with `node:test`.
5. **Event reactions** (map the real event names from `channel.js`; follow the contract): task started → agent leaves its desk; file read → agent walks into that room, out of scope flashes amber with a tag "Out of scope: <file>"; action proposed → agent kicks a ball toward the goal; Keeper decision ALLOW → ball goes through to Outside with a green tick; HOLD → Keeper catches and holds it (amber "Held for your approval"); BLOCK → Keeper dives and saves it (red card with the one-sentence owner_message); owner decision → Keeper releases or keeps the ball; untrusted inbound → villain at the window.
6. **Render on demand:** render only after a change, while an animation runs, or during interaction; stop while the tab is hidden.
7. **HTML overlays projected from 3D:** name tags above heads on a short leader line; tags of agents not in the current event fade to 50%. Decision cards and bubbles try a sorted list of nearby screen offsets and take the first one inside the stage and clear of every tag; if none is clear, dock at the top-left.
8. **2D fallback:** a flat still-frame map of the same zones and agents when the stage is narrower than 600 px, WebGL is missing, or prefers-reduced-motion is on; show which reason applies.
9. **Click** a ball, card or agent to open a side drawer with the decision: decision, rules cited, evidence, owner_message.

## Modes
- **Live:** `/floor/?token=<owner token>` subscribes to `/api/events` (it replays history first).
- **Replay:** a scrubber and play/pause/speed (1x, 2x, 4x) over the loaded events.
- **Sample:** `public/floor/sample-events.json` generated from a real rogue run (write a small script `scripts/floor-sample.js` that runs the scenarios through the channel in a temp runtime and saves its events); the page uses it when opened without a server, so the demo video always works.

## Server
- In `src/mcp/http.js`, serve `public/floor/` at `GET /floor/` as static files (no token needed for the static files; the API stays token-protected). Block path traversal. Add a test.

## Rules
- Plain JS ES modules, no npm installs, no network at build or test time. three.js 0.160.0 via a jsDelivr import map only.
- Do not change `src/keeper/` decisions or `fixtures/`. `npm test` must pass; `node scripts/score.js` and `node scripts/rogue.js` must still give Kit 15/15, Extra 6/6, Normal 37/37, 0 false alarms.
- All geometry in code; no downloaded models, textures or fonts; original designs. Do not read or copy files from any folder outside this repo.
- Do not run git.
- Render headless if you can and fix unreadable labels, overlaps and tiny characters.

## Report
`docs/FLOOR-result.md`: how to open live, replay and sample; event-to-scene mapping table; tests; screenshots you checked; anything unverified. Under 60 lines.
