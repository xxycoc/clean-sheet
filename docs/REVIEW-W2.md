Found nine issues, most severe first:

1. **High — Owner approval and private logs are accessible without authorization.** `src/mcp/http.js:35`, `:37`, `:58` expose the queue, full audit records and release endpoint without an owner credential. Audit records include denied reads’ `observed_file` contents.
   Failure case: a caller with HTTP access retrieves a blocked file from `/api/log` or releases its own held action.

2. **High — Updated files erase previously observed sensitivity.** `src/mcp/channel.js:148` restores saved read provenance only when the file is missing; an existing replacement takes precedence.
   Failure case: after reading confidential material, replacing its workspace file with public content changes a subsequent upload from **BLOCK to ALLOW**. Reproduced in memory.

3. **High — Malformed request URLs escape error handling.** `src/mcp/http.js:22` constructs `URL` before the `try` inside an async request listener.
   Failure case: a request target such as `http://[` throws an unhandled rejection, potentially terminating the Node server. Confirmed the parser throws; server termination was not exercised.

4. **Medium — Reusing the runtime breaks rogue-run score parity.** `scripts/rogue.js:8` uses the persistent default runtime, while `src/mcp/channel.js:47` seeds only once.
   Failure case: the first run deletes Nimbus’s erroneous patient-data file; the second run encounters a missing file and changes the expected ALLOW decision to BLOCK. Tests use fresh runtimes and miss this.

5. **Medium — Replay accepts truncated audit history as valid.** `scripts/replay.js:24`, `:34` call `verify(rows)` without the saved expected head.
   Failure case: removing trailing events leaves replay verification reporting valid. Reproduced with an in-memory two-event log truncated to one.

6. **Medium — Briefing descriptions are tailored to fixture names.** `src/briefing.js:24`, `:31`, `:33` infer Support/QuickPrint and Sales/Ferro from filenames; `tests/mcp.test.js:82` asserts those fixed phrases.
   Failure case: another agent reading a cashflow file is reported as Support replying to QuickPrint. Reproduced with synthetic events.

7. **Medium — Briefing understates independent receivables at risk.** `src/briefing.js:16` takes the maximum evidence amount across all pending deletions.
   Failure case: two separate records showing SGD 100 and SGD 200 produce SGD 200 at stake instead of SGD 300. Reproduced.

8. **Medium — Ordinary product references trigger sensitive-data holds.** `src/keeper/labels.js:11` treats any letter, seven digits and another letter as an NRIC.
   Failure case: “Your product reference is A1234567B.” to an existing client receives **HOLD_FOR_APPROVAL**. Reproduced through the engine; inherited engine issue.

9. **Low — W2 completion evidence is missing.** `result.md:1` still says “Completed W1” and contains no W2 test summary, rogue output, briefing or implementation gaps.
   Failure case: reviewers cannot substantiate the required W2 completion claims from its deliverable.

**Runtime carry-over:** No `runtime/` directory exists here. The implementation preserves workspace edits/deletions, queued approvals, audit history and open tasks with read provenance. Stdio resumes under the same session identity; HTTP sessions are recreated, leaving restored tasks inaccessible through their old IDs. Existing outbox/upload/action artifacts also remain.

**Category coverage:** Score-related fixture tailoring exists in the briefing; I found no scenario-ID decision branching or fabricated evidence credit in the reviewed scorer paths. No additional path-traversal or NEVER-precedence defect found.

**Verification:** Read-only fixture scoring passed **15/15 kit, 6/6 extras, 36/36 normal actions**. Targeted in-memory checks above passed. No files changed; the filesystem-writing MCP suite and live transports were not run.