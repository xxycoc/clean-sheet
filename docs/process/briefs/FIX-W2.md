# FIX-W2 brief

Repo: this folder (branch w2-channel). Node 24, no npm installs, no network, do not run git.

Problem: `node scripts/rogue.js` printed "Normal actions: 35/36 correct; 1 false alarms" when run a second time on this machine, though the first run (and your W2 report) gave 36/36. `node scripts/score.js` gives 36/36. Likely cause: state left in `runtime/` (workspace copy, outbox, events, approval queue, deleted files, log) from an earlier run changes a later decision. Find the real cause first: run rogue.js twice in a row and name the action that flips and why.

Fix the cause so that `node scripts/rogue.js` gives Kit 15/15, Extra 6/6, Normal 36/36 on every run, including back-to-back runs and after `npm test`. Prefer making each rogue run start from a fresh runtime copy (or its own temp runtime dir) over changing engine decisions. Do not change `src/keeper/` decisions or `fixtures/`. Add a test that runs the rogue suite twice and asserts 36/36 both times. Keep `npm test` passing.

Write your report to docs/FIX-W2-result.md: the cause (file:line), the fix, files changed, and the output of two consecutive rogue runs plus the npm test summary. Under 40 lines.
