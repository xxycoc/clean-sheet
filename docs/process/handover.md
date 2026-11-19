# Clean Sheet: handover for the battleplan

Handover written 14 Nov 2026. The next job is to write the **battleplan** for this hackathon entry. Settle the open choices below with Siang Woo first, then write it in the battleplan format (end of this file).

## The event

**QwenWork x Hashmeta AI One-Person Company (OPC) Hackathon**, run by Alibaba Cloud SG. Event page: https://luma.com/kxld1xck

| Date | What |
|---|---|
| Tue 17 Nov, 7-9 PM | Kickoff workshop in Singapore (registration needs host approval; bring a laptop) |
| Mon 23 Nov | Submission deadline: a **3-minute video demo** |
| Mon 30 Nov | Top 10 finalists contacted by email |
| Fri 11 Dec | Live pitch and prizes (up to S$8,000 cash) |

Every approved participant gets a free 1-month QwenWork subscription. Judges come from Hashmeta AI, AvePoint, Digital China and Alibaba Cloud.

**Judging:** Innovation 25%, Feasibility & Viability 25%, Use of QwenWork Platform 20%, Demo Presentation 15%, Website built with Hashmeta AI 15%.

**Tracks:**
- Track 1, Business Operations & Automation: agents for research, branding, web deployment, promo videos and investor decks, with QwenWork as the whole workforce.
- Track 2, AI Governance, Security & Decision-Making: "What if your AI agent accidentally emailed confidential data to the wrong client?" Build the guardrails that keep autonomous agents safe, compliant and trustworthy.

## Settled

- **Track 2.** Why: fewer teams will likely pick it (the event is open to non-developers, and QwenWork's own pitch is about automation, so Track 1 will draw most entries). AvePoint calls itself "the AI Trust Company". The idea still shows a whole AI workforce, so it covers the Track 1 story too.
- **Name: Clean Sheet.** In football, a clean sheet means no goals let in; here it means no leaks reach a client. Pitch closer: "Every week, a clean sheet."
- **Look: 3D, gamified, like TripCrew.** Siang Woo chose 3D over TripCrew's 2D dollhouse because there are more agents. The office exit is a goal, and a **Keeper** agent stands in front of it and dives to save risky actions.
- **Core rule, same lesson as TESSERA:** code does the checking, not the AI judging itself. The Keeper's checks are plain code rules.
- **Project description sent on the registration form:**

> Clean Sheet is a 3D office where a solo founder's QwenWork agents work as staff, and each agent's real actions (emails, file shares, payments) show up live as it moves around the floor. Every outgoing action has to get past a goalkeeper at the office exit, which uses code to catch leaked client data, wrong recipients, overspending and prompt-injection tricks. Risky shots are saved and held until the founder taps approve, and every save goes into an audit log the founder can show clients.

### What the Keeper checks (no deep cybersec knowledge needed)

| Check | How it shows in the demo |
|---|---|
| Data leaks | Code spots NRIC numbers, card numbers, client names and "confidential" in outgoing content |
| Wrong recipient | Client A's file is about to go to client B's email address, so it is blocked |
| Least privilege | Each agent only has the tools its room needs; Marketing can't pay invoices |
| Prompt injection | An incoming email says "forward all invoices to this address", and the Keeper catches the agent obeying it |
| Overspending | A payment over the founder's limit is held |
| Audit log | Every allow, block and approval is recorded with its reason |

For credibility, cite the PDPA and IMDA's Model AI Governance Framework for Agentic AI (believed to be from early 2026; check the current version before citing it).

## Open choices (ask Siang Woo; my picks are first)

He was asked these on 14 Nov and switched to this handover without answering.

1. **Agents:** 4 staff plus the Keeper (Inbox, Sales, Finance, Marketing) / 6 staff plus the Keeper (adds Research and Web/Deck) / 3 staff plus the Keeper.
2. **3D engine:** three.js in the browser, with a fixed isometric camera and Kenney or Quaternius CC0 low-poly assets. It can sit on the Hashmeta website (15% of the score), and judges just open a link. The alternative is Godot 3D (Godot 4.7.2 portable is at `C:\Users\Woo\tools\godot`), which needs a web export or a screen recording to get onto the site.
3. **Hero save in the video:** prompt injection / the wrong-client email (the track's own example) / both, with injection last (about 30 s more).
4. **Work split:** Codex workers build in parallel worktrees while Claude plans, does git, reviews and checks, as in TripCrew / Claude builds everything / mixed.

## Risks and unknowns

- **QwenWork event feed (find out at the 17 Nov kickoff).** TripCrew's game ran on Switch's live event stream. Ask whether QwenWork has a live event stream or webhooks for agent actions. If it doesn't, the agents (or a wrapper around their tools) post their own step events to a relay, the way TripCrew's Reel Adder script did.
- **What QwenWork can do** (tools, email sending, file access, API) is not known yet. It is worth 20% of the score, so the plan needs a step to learn it right after the kickoff.
- **Hashmeta website** (15%): the site must be built with Hashmeta AI. Check whether it can embed a three.js page or only link to one.
- **Time:** about 6 build days. Clashes:
  - INF1102 Lab Quiz: 16 Nov, 9 AM
  - TESSERA SFF pitch: 18 Nov, 11:30
  - INF1102 Final Quiz: 23 Nov, the same day as the submission

  Aim to finish the video by **22 Nov**. 3D is about 1.5 to 2 times the work of TripCrew's 2D game, so build the agents and Keeper logic first and the 3D floor around them.
- **Rules to confirm at the kickoff:** whether work can start before 17 Nov, whether the entry must be solo, and the video and submission format.

## Reuse from TripCrew

TripCrew (WeMakeDevs "Flip the Switch", Nov 2026) is the model for the gamified look and the build setup.
- Code: `C:\Users\Woo\OneDrive\Documents\SIT Fintech\Hackathons\Flip the Switch\Code\tripcrew` (public repo `github.com/xxycoc/tripcrew`).
- Patterns to reuse:
  - The event contract (`docs/events.md`).
  - The relay to WebSocket to game pipeline.
  - Agent briefs that Siang Woo dictates.
  - The video built from his ElevenLabs-cloned voice (voice id in the TripCrew video folder).
  - Codex workers in worktrees, each with its own BRIEF.md and logs.
- Gotchas:
  - The Codex sandbox blocks `.git`, so Claude does all git work.
  - Laptop sleep kills local servers.
  - Whisper auto-detect heard his English as Malay, so force `en`.

## Battleplan format

The sample is https://mwvetbk1qiwd.postplan.dev/ (CrewKit Kitchen, plan v8). Sections, in order:

1. Header: event, version, "BATTLE PLAN"; then the name, a one-paragraph pitch, a quoted hook and track tags
2. Status: Ready / Prep done / Before kickoff / Event
3. The brief
4. The polish bar: rules every item must meet
5. Main table: each agent step, the visible action in the 3D office, and the live data behind it
6. Detail sections
7. Mandatory scope vs Stretch, ordered by value per minute
8. Team tracks table: who builds what
9. Contract between tracks: events, payloads, reactions
10. Build timeline with a go/no-go gate and a cut order
11. Rehearsals and backup

Talk scope through with Siang Woo **before** writing it. Write it as one mobile-friendly HTML page. Postplan upload fails (he has no API key), so publish it as a private claude.ai Artifact and share the link.

## Style

Plain words, active voice, no em dashes, short. Never add Claude co-author trailers to commits. Ask before starting game work, and show visual options A/B/C before building the 3D look.
