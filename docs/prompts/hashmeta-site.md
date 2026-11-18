# Hashmeta site: QwenWork prompts

Paste each step into QwenWork in order. Step 1 spends nothing. Step 2 uses the one site license: run it only after the plan from step 1 looks right.

## Step 1: plan only (no license, no credits)

```
Using the hashmeta connector, plan a website but do not create, generate or deploy anything yet.
First call list_site_licenses and get_guidelines and tell me what create_site and generate_site will cost.
Then draft the site setup and page plan below and show it to me for approval.

Product: Clean Sheet, a guardrail for one-person companies that run AI agents.
One line: "Your AI staff work all night. Clean Sheet keeps the sheet clean."
Audience: solo founders and small studio owners with no technical background who let AI agents send emails, quote prices and pay suppliers.
Tone: plain, calm, confident. Short sentences. No jargon. Football keeper metaphor used lightly.

Pages:
1. Home
   - Hero: the one line, a sub-line "Every email, quote and payment your agents make passes the Keeper first", and a "Join the waitlist" button.
   - The problem: an AI agent can email a client's file to the wrong client, offer a price below your floor, or pay a fake supplier, and you find out after.
   - How it works, three steps: your agents work through one logged channel; the Keeper checks each action against your rules and lets it through, holds it for you, or blocks it, and tells you why in one sentence; every morning you get a 60-second briefing.
   - The four moments: a rogue agent caught, a risky payment stopped, a made-up number flagged, the morning briefing.
   - Proof: "Scored 15 out of 15 on AvePoint's Agents Watching Agents test set, with zero false alarms on normal work."
   - Built on QwenWork: the agents and the briefing run in QwenWork.
   - Waitlist form.
2. Pricing: Free for one agent. Solo, SGD 19 a month, up to five agents and the daily briefing. Studio, SGD 49 a month, unlimited agents, approval by WhatsApp, and audit export. Mark it "Early access pricing".
3. How it works: a longer version of the three steps, the three decisions (Allow, Hold, Block) and an example owner message for each.
4. Trust: what the Keeper logs, that the log cannot be edited without detection, and that no agent decision is made by an AI model: the rules are code you can read.

Form: "Join the waitlist" with name, email, company name, "How many AI agents do you run?" (0, 1 to 2, 3 to 5, 6+). Thank-you message: "You're on the list. We'll email you when Clean Sheet opens."

Design: dark navy background, white text, one accent colour (pitch green #2BD47D) for Allow, amber for Hold, red for Block. Clean sans-serif. Mobile first.
```

## Step 2: build (uses the license, after you approve the plan)

```
The plan looks right. Create the site with create_site, apply the setup, generate it, and show me get_site_build_status until it is done. Then create the waitlist form and place it on Home. Do not deploy or publish yet; give me the preview link.
```

## Step 3: publish

```
Publish the Clean Sheet site and give me the live URL.
```
