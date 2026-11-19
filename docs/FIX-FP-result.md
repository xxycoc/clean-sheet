# FIX-FP result

Completed the interrupted implementation and retained its working policy changes.
References below identify the final code locations; no git history was used.

## Causes
- Read-wide inheritance confused access with disclosure; corrected at `src/keeper/labels.js:63` and consumed by R20 at `src/keeper/policy.js:129`.
- Owner mail was treated as an unknown external recipient; discovery is at `src/keeper/engine.js:10`, clearance at `src/keeper/policy.js:18`.
- Owner messages conflated attempted reads with scope violations and blocked reads; corrected at `src/keeper/engine.js:37` and `src/keeper/messages.js:31`.
- The new meeting variant exposed R18 parsing “at 10:15 am” as price 10; corrected at `src/keeper/figures.js:12`.

## New inheritance rule
Inherit a file's label only when it is attached or outgoing content matches its non-recipient email, numeric identifier/figure/phone, or five consecutive normalized words.
Exclude routing and source-path metadata and the recipient's own email address from matching, and attribute copied contact-table material only to the matching client rows.

## Every keeper change, including retained interrupted work
- `engine.js`: derive owner addresses from trusted Owner lines matching the policy owner; separate outgoing payload from routing/source paths; evaluate scope and blocked reads separately; include available observed snapshots when matching content after replacement or deletion.
- `labels.js`: content-based inheritance, recipient-address exclusion, normalized numeric and phrase matching, attachment inheritance, matching-row client ownership, and deduplication after matching current/snapshot content.
- `policy.js`: trusted owner recipients and all-label owner clearance; R20 uses travelling content and checks each non-owner recipient; owner-only mail avoids R19 disclosure treatment; owner identity also informs R21 checks, written confirmations and deletion notifications.
- `messages.js`: list only out-of-scope paths in the scope warning and actually blocked paths in the blocked-read warning.
- `figures.js`: exclude explicit clock-time spans from financial/date extraction while retaining price checks.
- No scenario IDs, file names or client names were special-cased in keeper code.

## Tests
- Added five normal read-then-send sequences: both real sends, Nimbus meeting time, supplier reprint-date inquiry, and owner note naming a client (37 to 42).
- Added guards for another client's phone, figure and email; external client-list attachments; and Ferro proposal quotations in body or subject without attachments.
- Added recipient-email exclusion, renamed owner discovery, untrusted owner spoof rejection, owner regulated attachment clearance, external CC/BCC, scope-message accuracy and clock-time checks.
- Replayed fixture task starts, listings, reads, proposals and task endings through Channel: BLOCK / ALLOW / ALLOW, exactly two local outbox artifacts and a valid audit chain.
- Updated old read-taint assertions while retaining copied-content deletion/restart and attachment protections; added copied-content replacement/restart coverage.
- Updated MCP/CLI normal-count assertions to use the dataset size.

## Final verification
- `npm.cmd test` (Windows npm entry point): 101/101 passed, including stdio and HTTP integration.
- `node scripts/score.js`: Kit 15/15; Extra 6/6; Normal 42/42; 0 false alarms; labels 28/28.
- `node scripts/rogue.js`: Kit 15/15; Extra 6/6; Normal 42/42; 0 false alarms.
- S2, S4, S5 and S7 retain their required decisions, rules and evidence.
- Fixture clarification: its first task declares empty scope and logs the lookalike read as `in_scope: false`, `ALLOW`. The scope warning is therefore accurate; the false blocked-read claim is removed. A separate explicitly in-scope test verifies that neither warning appears.
- No git commands or fixture edits. Execution checks use the local demo channel/outbox, not external mail delivery.
