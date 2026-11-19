# FIX2-W2 brief

Repo: this folder (branch w2-channel). Node 24, no npm installs, no network, do not run git. Review findings are in docs/REVIEW-W2.md. Fix findings 1, 2, 3, 5, 6, 7 and 8. Skip 4 (already fixed) and 9.

1. Console auth: protect `/api/queue` (all methods, including release and reject) and any endpoint returning audit records or file contents with an owner token. Read it from env `CLEAN_SHEET_OWNER_TOKEN`; if unset, generate one at startup, write it to `runtime/owner-token.txt` and print where it is (never print the token). Accept `Authorization: Bearer <token>` or `?token=` (the SSE stream needs the query form). `/mcp`, `/sse`, `/messages` stay open for agents. Also strip file contents of denied reads from anything the console API returns.
2. Read provenance: once a task has observed a file at a sensitivity level, a later replacement of that file must not lower the level for that task. Keep the highest observed label.
3. Malformed URL: move URL parsing inside the try, return 400, and make sure no async listener can reject unhandled. Add a test that sends a bad request target and the server still answers the next request.
5. Replay: store the expected chain head (count and last hash) with saved runs and make replay verification fail on truncation. Add a test.
6. Briefing: remove every inference from fixture file names or client names (QuickPrint, Ferro, Support, Sales and similar). Describe events from the event data itself (agent, action, file label, rule, owner_message). Update tests so they assert structure and facts taken from the log, not fixed phrases. Keep 140 to 160 words and the S5 reads mention (derived from data).
7. Money at stake: sum independent amounts across separate pending items; do not double count the same evidence amount for one item. Add a test (100 + 200 = 300).
8. NRIC false positive: make `src/keeper/labels.js` NRIC detection require context (a nearby word such as NRIC, IC, FIN, passport, ID number, or a regulated file label) instead of any letter-7digits-letter. "Your product reference is A1234567B." to an existing client must ALLOW. Add that as a normal action in tests and keep the kit identifiers detected.

Hard gates: `npm test` passes; `node scripts/score.js` and `node scripts/rogue.js` (run twice) each give Kit 15/15, Extra 6/6, Normal 37/37 (36 plus your new one) with 0 false alarms. List every `src/keeper/` change.

Report to docs/FIX2-W2-result.md: per finding, the change (file:line) and its test; final npm test summary; both score outputs. Under 60 lines.
