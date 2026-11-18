# Review brief (read-only)

You are reviewing work on Clean Sheet, an oversight engine scored against AvePoint's starter kit (`fixtures/starter-kit/`) plus our extras (`fixtures/extra/`). The brief the builder followed is named in your prompt. Read it, then the code it produced.

Report concrete findings, each with `file:line`, severity (high / medium / low), and a one-line failure case. Look hardest for:

1. **Score gaming**: engine code that branches on scenario IDs, hard-codes kit file names, client names or figures, or test files that copy expected answers into the engine's inputs. A scorer that marks evidence as cited when the engine did not produce it.
2. **Wrong decisions**: any kit rule (R01 to R19) or ours (R20 to R22) applied against its text in `rules/policy.md`; NEVER not outranking APPROVE; blocked or held actions that still execute or leak file content.
3. **False positives** a real owner would hit: normal emails, quotes or payments wrongly held or blocked; brittle regexes (amounts, dates, NRIC pattern, domains).
4. **Robustness**: crashes on odd input, unhandled promise rejections, path traversal outside the workspace (`../`), log chain that verify() would pass when tampered.

Do not change any files. Write your findings, most severe first, as your final answer. Under 80 lines. Say plainly if you found nothing in a category.
