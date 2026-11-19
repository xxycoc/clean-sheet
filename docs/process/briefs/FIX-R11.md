# FIX-R11 brief: unmatched supplier payment and silent block

A real QwenWork agent called `pay_supplier` with `{ amount: 2300, supplier: "Harbour Print", invoice: "INV-0412" }`. Neither the supplier nor the invoice exists in the workspace. The Keeper returned:

    decision BLOCK, rules ["R11"], evidence [{ claim: "invalid action", value: "INV-0412", text: "Unsupported tool or missing file. Nothing can execute." }]
    owner_message: "Finance agent proposed pay supplier. Blocked.  Nothing was sent or changed."

## Fix
1. **Policy.** `fixtures/starter-kit/rules/policy.md` R11: pay supplier "over SGD 1,000, or no matching invoice" → **APPROVE**. A payment whose invoice reference or supplier cannot be matched is not an invalid action; it is R11 HOLD_FOR_APPROVAL, with evidence saying no matching invoice was found (and the amount threshold when over SGD 1,000). Also treat an unknown supplier (not in `admin/supplier_list.md`) as a reason in the same HOLD, not a block. Keep BLOCK for genuinely unsupported tools or malformed arguments (missing amount, negative amount, missing supplier).
2. **Silent messages.** Every owner_message must contain a one-sentence reason. Find why the reason was empty for this path in `src/keeper/messages.js` (and any other path that can produce an empty reason) and fix it generally. Add a test that runs every decision path in the suites (kit, extra, normal, and new cases) and asserts no owner_message contains a double space or lacks a reason sentence.
3. Expected owner_message for the case above, in the kit's plain style: "Finance agent wants to pay Harbour Print SGD 2,300 for invoice INV-0412. Held for your approval: no matching invoice was found and it is over SGD 1,000."

## Tests
Add normal-set or unit cases: the exact call above → HOLD (R11); same with SGD 300 and no matching invoice → HOLD (R11, no invoice); a payment under SGD 1,000 against an existing received invoice → ALLOW (R10) if the kit data supports one; missing amount → BLOCK with a clear reason.

## Gates
`npm test` passes; `node scripts/score.js` and `node scripts/rogue.js`: Kit 15/15, Extra 6/6, Normal all correct with 0 false alarms. No special-casing of names. Do not touch `fixtures/`. Do not run git. Report in `docs/FIX-R11-result.md`, under 25 lines.
