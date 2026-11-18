# LOOKS result

Completed the three visual options in `docs/looks/index.html`. No final look was selected. All writes were confined to `docs/looks/`; no git commands were run.

## A · Low-poly studio
Warm isometric office with cream flooring, wooden desks, plants and rounded low-poly workers.
Soft daylight and low partitions create a small, approachable toy-like workspace.

## B · Match night
Dark striped office pitch under floodlight towers, with strong shadows and a stadium-style scoreboard.
Bright players, room labels and broadcast-style decision captions keep attention on the Keeper.

## C · Blueprint
Pale gridded floor plan with outlined, sensitivity-tinted rooms and minimal geometric workers.
Restrained furniture and written labels prioritize folder names, scope and decisions.

## Delivered behavior

- One page with A/B/C buttons and keys 1/2/3; changing looks restarts the sequence.
- Six named folder rooms, four named worker agents, and a Keeper in the front goal exit.
- 0–5 seconds: Sales visits Clients and returns. 5–9: Finance enters Admin; the room flashes and the exact out-of-scope message appears.
- 9–13: Sales kicks an allowed ball through the exit, followed by a green ALLOW tick. 13–18: Finance kicks; the Keeper dives and stops the ball with the exact BLOCK reason.
- 18–22: Marketing kicks; the Keeper catches and holds the ball with the approval message. 22–25: final scoreboard reads “Saves 1 · Held 1 · Conceded 0”, then the sequence repeats.
- Reduced motion freezes the BLOCK scene at 16 seconds, including a stationary Keeper and ball. Room flashing is disabled in this mode.
- Responsive canvas framing, larger labels at video widths, wrapped captions on phones, and text sensitivity labels alongside color. Sensitivities are illustrative, documented in README.
- All geometry is code-generated. Only three.js 0.160.0 is external, loaded through the exact requested import map URL.

## Verification and limits

Passed `node --check` on an extracted inline module; the temporary module was removed. Passed local source assertions for the import map version, room names, exact messages, final score, three buttons, keyboard mapping, reduced-motion branch, phase structure and single external URL. These are syntax and source checks, not browser execution tests.

CDN loading, WebGL rendering, animation appearance, shadow quality, label overlap and legibility at phone and 1920×1080 sizes remain unverified in a browser, as the brief specifies the CDN cannot be loaded in this sandbox. No visible browser actions were performed. This is a scripted look study, with no backend integration or real policy decisions.

## File sizes

- `index.html`: 17,157 bytes.
- `README.md`: 1,962 bytes.
