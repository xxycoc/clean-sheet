# FIX-R11 result

- Fixed: unmatched supplier payments now HOLD_FOR_APPROVAL under R11.
- R11 was already APPROVE in both policy fixtures; fixtures were left untouched.
- Cause: generic missing-file validation incorrectly treated invoice references as required files.
- Invoice lookup supports workspace paths and invoice references; matching unpaid invoices below the threshold use R10.
- Evidence explains missing invoice matches, unknown suppliers, and the amount threshold.
- Missing, nonnumeric or negative amounts and missing suppliers BLOCK with explicit reasons.
- Unsupported tools and genuinely missing required files still BLOCK.
- Owner messages now always include a reason and normalize whitespace; ordinary deletion holds also explain why.
- Exact regression message: Finance agent wants to pay Harbour Print SGD 2,300 for invoice INV-0412. Held for your approval: no matching invoice was found and it is over SGD 1,000.
- Added payment edge cases and a message invariant across kit, extra, normal and new decision paths.
- Added three normal scenarios; updated integration expectations for two extra pending payments totaling SGD 2,600.
- `npm.cmd test`: 131/131 passed, including stdio and HTTP integration tests.
- `node scripts/score.js`: Kit 15/15, Extra 6/6, Normal 45/45, zero false alarms.
- `node scripts/rogue.js`: Kit 15/15, Extra 6/6, Normal 45/45, zero false alarms through MCP stdio.
- No Git commands were run. No fixture files were edited.
- Validation used local demo execution; no live QwenWork session or real payment was performed.
