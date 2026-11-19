# QwenWork prompt: the morning briefing

Goal: a scheduled QwenWork task reads the Keeper's daily summary and turns it into a 60-second video for the owner.

Fill in before pasting:
- `SERVER` = the current tunnel address (it changes when a quick tunnel restarts)
- `TOKEN` = the contents of `C:\Users\Woo\cleansheet\runtime-http\owner-token.txt` (paste it into QwenWork yourself)

`GET SERVER/api/briefing` (header `Authorization: Bearer TOKEN`) returns JSON: `date`, `script` (up to 160 words, written by the Keeper's code from the log), `counts` (blocked, held, allowed, pending and others), `read_details` and `action_details`. Add `?date=YYYY-MM-DD` for another day.

## Step 1: one run now

```
Make me a morning briefing video for Lumen Studio, a one-person design studio.
1. GET SERVER/api/briefing with the header Authorization: Bearer TOKEN.
2. Use the "script" field as the voiceover, word for word. Do not add facts, numbers or names that are not in the JSON.
3. Make a video of about 60 seconds: calm voice, navy background (#0b1b2b), white text.
   - Open on the date and "Keeper briefing".
   - Show counts as three numbers: Blocked (red #e5484d), Held (amber #f5a623), Allowed (green #2bd47d).
   - For each item in action_details, show one line while the voice covers it.
   - Close on "Nothing was sent or paid without the Keeper. Decide held items in the Keeper Console."
4. Give me the video and the JSON you used. If you cannot reach the server, say so and stop; do not invent a briefing.
```

## Step 2: schedule it

```
Schedule the task above to run every day at 07:00 Singapore time and send me the video when it finishes.
```

What to check: the voiceover matches `script` exactly (compare with `npm run briefing`), the three numbers match `counts`, and the video runs close to 60 seconds. A cloud schedule needs a tunnel address that does not change, so set up a fixed tunnel before step 2.
