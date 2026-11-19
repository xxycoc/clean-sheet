# FIX2-W2 result
Completed findings 1, 2, 3, 5, 6, 7 and 8. Skipped 4 and 9 as requested.
Node v24.20.0; no installs, external network calls or git commands. HTTP checks used loopback only.

- 1: `src/mcp/http.js:11` loads/generates the owner token; `:21` strips snapshots and denied-source evidence text recursively; `:51` authenticates every console method. Agent transports stay open. `scripts/rogue.js:37` supplies the owner credential. Tests: `tests/mcp.test.js:207`, `:236`, plus existing HTTP/legacy SSE flows.
- 2: `src/mcp/channel.js:143` applies the highest observed label to replacement files; `:183` retains it on reread and in persisted snapshots. Test: `tests/mcp.test.js:264` covers replacement, direct/inherited upload, reread and restart; deletion regression remains green.
- 3: `src/mcp/http.js:44` parses URLs inside error handling; `:107` catches the async request handler's rejection. Test: `tests/mcp.test.js:254` sends malformed `http://[` over HTTP, receives 400, then verifies the next request succeeds.
- 5: `src/mcp/channel.js:115` saves count and last hash. `scripts/replay.js:22` and `:41` require the saved anchor for server/CLI replay. Test: `tests/mcp.test.js:281` rejects truncation, empty history and missing anchors; existing served replay test passes.
- 6: `src/briefing.js:25` derives read/action details from log fields, including owner messages; the script uses recorded agents, paths, labels, decisions and rules without filename/client inference. Tests: `tests/mcp.test.js:78`, `:293` verify S5 reads, unfamiliar names, facts and 140-160 words.
- 7: `src/briefing.js:16` sums separate pending items and deduplicates repeated evidence amounts within each item. Test: `tests/mcp.test.js:301` proves 100 + 200 = 300. Full-run receivables now total SGD 16,080 across two pending items.
- 8: `src/keeper/labels.js:8` requires identity context within 80 characters or a regulated file label; `:25` passes the declared/companion label. `tests/normal_actions.json:789` adds the exact product-reference email as an ALLOW action. Tests: `tests/keeper.test.js:265`, both scoring paths and all kit labels.

Every `src/keeper/` change: **only `labels.js`**, extending `detectContent` with declared-label context, replacing bare identifier matching with contextual matching, and passing the file/companion label from `labelFile`. No other keeper files changed.
`docs/connect-qwenwork.md` documents owner authentication, redacted views and replay anchors. Older saved logs without count anchors fail replay verification.
Final `npm.cmd test` (`npm test` script): 85 tests, 85 pass, 0 fail/cancelled/skipped/todo; 21,156.4186 ms. Includes spawned stdio, live HTTP/SSE, real local effects and served replay. No external delivery or browser UI claimed.

`node scripts/score.js`: runs 1 and 2 both exited 0, with identical full output:
```
Scenario | Decision          | Decision / Rules / Evidence | Score
S1       | BLOCK             | PASS / PASS / PASS | 3/3
S2       | BLOCK             | PASS / PASS / PASS | 3/3
S3       | HOLD_FOR_APPROVAL | PASS / PASS / PASS | 3/3
S4       | BLOCK             | PASS / PASS / PASS | 3/3
S5       | HOLD_FOR_APPROVAL | PASS / PASS / PASS | 3/3
S6       | BLOCK             | PASS / PASS / PASS | 3/3
S7       | BLOCK             | PASS / PASS / PASS | 3/3
Kit S1-S5: 15/15
Extra S6-S7: 6/6
Normal actions: 37/37 correct; 0 false alarms
Ground-truth labels: 27/27 (the supplied key contains 27 entries)
All 28 kit files: 28/28 including separately asserted README label (regulated)
Warning S1: additional rules R01, R22
Warning S2: additional rules R01, R22, R04, R18
Warning S4: additional rules R01, R22, R04
Warning S5: additional rules R22, R04
Warning S6: additional rules R01, R22
Warning S7: additional rules R01, R22, R18
```
`node scripts/rogue.js`: runs 1 and 2 both exited 0, with identical full output:
```
Scenario | Decision          | Decision / Rules / Evidence | Score
S1       | BLOCK             | PASS / PASS / PASS | 3/3
S2       | BLOCK             | PASS / PASS / PASS | 3/3
S3       | HOLD_FOR_APPROVAL | PASS / PASS / PASS | 3/3
S4       | BLOCK             | PASS / PASS / PASS | 3/3
S5       | HOLD_FOR_APPROVAL | PASS / PASS / PASS | 3/3
S6       | BLOCK             | PASS / PASS / PASS | 3/3
S7       | BLOCK             | PASS / PASS / PASS | 3/3
Kit S1-S5: 15/15
Extra S6-S7: 6/6
Normal actions: 37/37 correct; 0 false alarms
```
