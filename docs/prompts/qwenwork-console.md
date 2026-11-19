# QwenWork prompt: Keeper console (feasibility test first)

Goal: find out whether an app built in QwenWork can call the Clean Sheet tool server and keep its own database. Run step 1 first; only build the full console if it works.

Fill in before pasting:
- `SERVER` = the current tunnel address, e.g. `https://<words>.trycloudflare.com` (it changes when the tunnel restarts)
- `TOKEN` = the contents of `C:\Users\Woo\cleansheet\runtime-http\owner-token.txt` (paste it into QwenWork yourself; do not share it elsewhere)

## Step 1: feasibility (small)

```
Build me a small web app called "Keeper Console (test)".
It talks to my Clean Sheet server at SERVER. Every request sends the header
Authorization: Bearer TOKEN.
1. On load, GET SERVER/api/scorecard and show the totals it returns.
2. GET SERVER/api/queue and list each pending item: the agent, the action, the amount or recipient, the Keeper's one-sentence reason. Refresh every 5 seconds.
3. Each item has Approve and Reject buttons: POST SERVER/api/queue/<id>/release or SERVER/api/queue/<id>/reject, then refresh.
4. Save every Approve/Reject I make in the app's own database (time, item id, agent, action, my decision) and show that history in a "My decisions" table that survives a page reload.
Tell me what you built, where it runs, and the link to open it. If you cannot call an external server or cannot store data, say exactly which part is not possible.
```

What to check: the scorecard shows Kit 15/15, Extra 6/6; queue items appear after an agent action is held; approving one makes it disappear and appear in "My decisions"; reload keeps the history.

## Step 2: full console (only if step 1 works)

```
Turn Keeper Console into the owner's daily console, same server and token:
- Top: today's counts (allowed, held, blocked) and the scorecard.
- Live feed: GET SERVER/api/events?token=TOKEN is a Server-Sent Events stream. Show each keeper.decision as a row: time, agent, action, ALLOW (green) / HOLD (amber) / BLOCK (red), and the owner_message sentence. Newest first.
- Approval queue with Approve/Reject as before, plus the money at stake per item.
- "Morning briefing": GET SERVER/api/briefing and show the 60-second script text.
- "Watch the floor": embed https://xxycoc.github.io/clean-sheet/floor/?server=SERVER&token=TOKEN in a panel.
- Keep "My decisions" in the database.
Style: dark navy background (#0b1b2b), white text, green #2BD47D for allow, amber #F5A623 for hold, red #E5484D for block. Plain, calm wording for a non-technical owner.
```
