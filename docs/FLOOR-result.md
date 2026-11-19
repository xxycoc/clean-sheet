# FLOOR result

Implemented the brief while preserving the interrupted run's approved cast, floor, controls, server route and tests.
Finished the stale browser bundle, release-revalidation queue handling, animated Keeper dive and amber room flash.
Fixed fallback decision cards covering the map; cards now have their own area below the scrollable rooms.
No git commands, installs, fixture edits or Keeper decision changes were made.

## Open
- Live: run `node src/mcp/http.js`, then visit `http://127.0.0.1:8787/floor/?token=<owner token>`.
- Use `CLEAN_SHEET_OWNER_TOKEN`, or read the generated token from the runtime's `owner-token.txt`.
- Static `/floor/` files are public; `/api/events` and other owner APIs remain token-protected.
- Replay: select Replay for loaded events, or Load event log for a JSON array / JSONL file. Scrub or play at 1x, 2x or 4x.
- Sample: open `public/floor/index.html` directly, or `/floor/` without a token. Select Sample to reset to the real recorded run.
- Regenerate sample: `node scripts/floor-sample.js` runs rogue scenarios through the real channel in a temporary runtime, then saves 238 sanitized events as JSON and a direct-file script.
- Rebuild after editing source modules: `node scripts/floor-build.js`. It creates `runtime.js` for browsers' direct-file restrictions, without dependencies or network.
- 3D uses only the pinned three.js 0.160.0 jsDelivr import map at viewing time. Without it, the sample still works in 2D.

## Event mapping
| Event | Floor reaction |
| --- | --- |
| `task.started` | Named staff member leaves its desk. |
| `file.read` | Visits the folder room; out-of-scope amber tag and room flash; updates highest sensitivity. |
| Untrusted/lookalike inbound read or lookalike instruction source | Villain appears at Inbox window. |
| `directory.listed` | Updates current activity. |
| `action.proposed` | Staff approaches the goal and kicks a ball. |
| `keeper.decision`: ALLOW | Ball passes toward Outside; green tick on decision card. |
| `keeper.decision`: HOLD_FOR_APPROVAL | Keeper catches; amber approval card and pending count. |
| `keeper.decision`: BLOCK | Keeper dives; red owner-message card; villain slinks away. |
| `approval.queued` | Records pending approval. |
| Revalidation | Updates verdict while keeping pending queue membership until an owner decision. |
| `owner.decision` | Releases or keeps the ball; removes the pending approval. |
| `action.executed` / `action.failed` | Ball leaves / failure card replaces it. |
| `task.ended` | Staff returns to its desk. |
| `briefing.ready` | Briefing card. |
| `notification.queued` | Retains the action scene; shows event type. |

`sceneAt(events, index)` is pure and supports backward scrubbing. Saves count blocked actions; Held counts pending approvals; Conceded counts unauthorized executions, not allowed work.
Click a character, ball or decision card for rules, evidence and the owner's message.

## Verification, 19 November 2026
- `npm test`: 94 passed, 0 failed, including pure-state replay, revalidation, overlay placement, bundle parity, real labels, public static serving, protected API and traversal rejection.
- `node scripts/score.js` and `node scripts/rogue.js`: each Kit 15/15, Extra 6/6, Normal 37/37, 0 false alarms.
- `node scripts/floor-check.js`: existing headless Chrome, temporary local server; external HTTPS blocked to keep tests offline.
- Browser checks: live Channel-to-SSE events and history reload; replay play/pause at 4x; decision drawer; file:// sample; reduced-motion and narrow-stage fallbacks; no uncaught exceptions; no horizontal overflow at 390px or 320px.
- Visually checked current `floor-check/desktop-out-of-scope.png`, `decision-drawer.png`, `desktop-villain.png`, and `mobile-320.png`: readable labels, drawer evidence and separate map/card areas. Narrow maps scroll vertically.
- Additional captured states and machine results are in `docs/floor-check/`; `tests.txt` contains the full test output.
- Unverified: actual WebGL rendering, 3D label collisions, character scale, gloves/jersey visibility, and motion quality. No local three.js exists; the pinned CDN is blocked during offline checks. Desktop screenshots therefore show the 2D fallback, not verified 3D.
- Live verification used local Channel actions, not external QwenWork agents or external delivery. No persistent server was left running.
