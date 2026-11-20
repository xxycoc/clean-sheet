# Demo video: script and shot list

Target: 2:50, under the 3:00 limit. The final cut is assembled in QwenWork (a rule of the hackathon), then uploaded to YouTube.

## 1. Before recording

| Check | How |
| --- | --- |
| Fresh run, counters at zero | Claude restarts the tool server on a new runtime folder (`runtime-demo`). This also gives the new "Held by the Keeper:" wording. A new runtime means a new owner token: paste it into the Keeper Console again. |
| Tunnel up | The address is in `~/fleet-jobs/2026-11-19-tunnel/url.txt`. The QwenWork connector uses `localhost`, so only the Console needs the tunnel. |
| Screen | 1920x1080, browser zoom 100%, notifications off, bookmarks bar hidden, dark theme in QwenWork if available |
| Windows ready | Live floor (`/floor/?token=â€¦`) on the left half, QwenWork chat on the right half. Keeper Console in a second tab. |
| Recorder | Win+Alt+R (Game Bar) or OBS, one clip per shot below, named `C1.mp4`, `C2.mp4` â€¦ |

## 2. Recording order

Record in this order so the floor's counters build up in a sensible way: workday first (all ALLOW), then the catches, then the owner, briefing and Auditor.

| Clip | Run this | Prompt file | Roughly |
| --- | --- | --- | --- |
| C1 | Floor idle, slow pan with the mouse; then click the Keeper | none | 15 s |
| C2 | Normal workday, five jobs | `docs/prompts/qwenwork-workday.md` | 60 s raw |
| C3 | S6 lookalike email (Finance) | `docs/connect-qwenwork.md`, section 3 | 45 s raw |
| C4 | S2 price below the floor (Sales) | `qwenwork-crew-run.md`, S2 | 30 s raw |
| C5 | S3 delete unpaid invoices (Ops) | `qwenwork-crew-run.md`, S3 | 30 s raw |
| C6 | Keeper Console: the two held deletes, click Reject on both, history updates | none | 20 s |
| C7 | Briefing video plays | `qwenwork-briefing.md`, step 1 | 20 s of it |
| C8 | Auditor report appears | `qwenwork-auditor.md`, step 1 | 20 s raw |
| C9 | Terminal: `npm run score` result, then the GitHub README scrolls | none | 10 s |

S1, S4 and S5 are optional extras. Run them after C9 if you want more footage; the cut below doesn't need them.

## 3. Shot list and voiceover

About 330 words, which fits 2:50 at a calm pace. Times are for the final cut.

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00 to 0:15 | C1: the floor, five octopus staff at their desks, the Keeper at the goal by the only exit | Mei runs Lumen Studio alone. Her staff are five AI agents in QwenWork: marketing, sales, finance, ops and support. They work all night. Any one of them could send a client's file to the wrong client, quote below her price, or pay a supplier who isn't real. |
| 0:15 to 0:30 | C1: click the Keeper; tag "Keeper Â· rules as code" | So every action they take goes through one door, guarded by the Keeper. The Keeper is plain code, not AI. It checks each email, quote, payment, upload and delete against Mei's rules, and answers allow, hold or block, always with a reason. An agent can't talk its way past it. |
| 0:30 to 0:55 | C2 sped up: QwenWork chat on the right, five balls go out through the door on the floor | Most work should just go through. Here the five agents do a normal day: a reminder to a client, a quote from the price list, a thank-you note. All five allowed. In our tests, 45 everyday actions, zero false alarms. |
| 0:55 to 1:25 | C3: the lookalike email in the inbox, the agent tries to send invoices and bank details, Keeper blocks; floor shows the save and the reason card | Now the inbox holds an email from a lookalike of a real client's domain, asking for every invoice and the bank details, and telling AI agents to skip approval. The finance agent tries. The Keeper blocks it: the address resembles Ferro Logistics, but isn't it. Nothing was sent. |
| (C3b) | C1.mp4 0:45 to 0:55: the S4 Finance BLOCK card ("These figures have no matching source") | Finance defends an invoice with numbers that aren't in any file: 25 percent, 5 days, 5,250. The Keeper checks every figure against the contract, and blocks it. |
| 1:25 to 1:40 | C4: Sales offers 5,800, blocked | Sales tries to close a deal at 5,800. Mei's floor is 6,500. Blocked, and the reason quotes her own note. |
| 1:40 to 1:55 | C5: Ops deletes two invoices, both held | Ops wants to tidy up by deleting two old invoices. They're unpaid: 8,040 Singapore dollars Mei is still owed. That's her call, so the Keeper holds them. |
| 1:55 to 2:15 | C6: Keeper Console, Reject twice, history fills in | Held actions wait in the Keeper Console, which QwenWork built and hosts, with its own database. Mei reads one sentence per item and decides. Rejected. Every decision is saved. |
| 2:15 to 2:30 | C7: the briefing video | Each morning, QwenWork turns the Keeper's log into a one-minute briefing: what was blocked, what's waiting, and what the agents read that they didn't need. |
| 2:30 to 2:43 | C8: Auditor report, highlight the integrity line and a pattern | And a QwenWork Auditor reviews the log itself. It confirms the record hasn't been changed, and spots patterns, like an agent that keeps hitting the same rule. It advises. It can't approve anything. |
| (C10) | C10: the Hashmeta website scrolls from the hero to "Built on QwenWork" | The website, built with Hashmeta, tells owners the same story in plain words: the mistakes it stops, how the Keeper works, and pricing that starts free. |
| (C9b) | C9: the `npm run score` terminal | It runs today: one connector into QwenWork, 140 automated tests, and a log that shows if anyone changes it. |
| 2:43 to 2:50 | C9: score 15 of 15, 6 of 6, 45 of 45; end card with the line and links | All of AvePoint's scenarios pass. Clean Sheet: agents act, code decides, the owner approves. |

End card text: **Clean Sheet** Â· Agents act. Code decides. The owner approves. Â· cleansheet.geo.hashmeta.tech Â· github.com/xxycoc/clean-sheet

## 4. Assembly prompt for QwenWork

The voiceover is recorded: `demo-clips/voice/C1.m4a`, `C1b.m4a`, `C2.m4a` â€¦ `C9.m4a` (about 2:25 in total). `C1b` is the second C1 line ("So every action they takeâ€¦"). Upload the video clips C1 to C9 and the ten voice files into a QwenWork chat, then paste:

```
Edit these clips into one demo video, under 3 minutes, 1920x1080.
Use my recorded voice files as the timeline, in this order: C1, C1b, C2, C3, C3b, C4, C5, C6, C7, C8, C10, C9b, C9. C3b uses C1.mp4 (0:45 to 0:55), C9b uses C9.mp4. Do not generate a voice and do not change my audio, except to even out the volume.
- Under each voice file, show the video clip with the same number (C1 and C1b both use C1.mp4). Cut or speed up each video clip so it lasts exactly as long as its voice file.
- Speed up C2; trim the waiting in C3, C4, C5 and C8 so the Keeper's answer is on screen while the voice describes it.
- C7 is a 60-second briefing video with its own voice. Mute it, do not speed it up, and use only two parts: 0:00 to 0:07 (title, then the Blocked 2 / Held 2 / Allowed 5 numbers) and 0:20 onwards (the list of each request) to fill the rest of the C7 voice file.
- When a Keeper decision appears, zoom in gently on the reason text for 2 seconds.
- Soft background music, low under the voice.
- No other text overlays except the end card.
End card (last 4 seconds): "Clean Sheet", "Agents act. Code decides. The owner approves.", "cleansheet.geo.hashmeta.tech", "github.com/xxycoc/clean-sheet".
[paste section 3 here]
```

Then upload to YouTube as Unlisted (or Public), and check it plays signed out before submitting the link.
