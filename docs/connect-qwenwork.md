# Connect Clean Sheet to QwenWork desktop

Requires the existing Node 24 installation. No packages or installs are needed. These steps use the custom connector shapes in the local QwenWork `guide-mcp.md`; the actual desktop connection has not been tested by W2.

## 1. Test the small gate first

In QwenWork desktop, open Settings, Connectors, Custom MCP, then add a custom connector named `clean-sheet-hello`. Supply this config (the executable path was checked on this machine):

```json
{
  "command": "C:\\Program Files\\nodejs\\node.exe",
  "args": ["C:\\Users\\Woo\\OneDrive\\Documents\\SIT Fintech\\Hackathons\\QwenWork OPC\\Code\\clean-sheet-w2\\scripts\\mcp-hello.js"]
}
```

If using the QwenWork connector-management tool, the exact equivalent request is:

```json
{
  "key": "qwenwork.settings.connector.custom",
  "action": "add",
  "params": {
    "name": "clean-sheet-hello",
    "config": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\Users\\Woo\\OneDrive\\Documents\\SIT Fintech\\Hackathons\\QwenWork OPC\\Code\\clean-sheet-w2\\scripts\\mcp-hello.js"]
    }
  }
}
```

Query `qwenwork.settings.connector.custom.clean-sheet-hello`. Wait for `status: "connected"` and one listed tool, `keeper_ping`. Ask the worker to call it. The response must be `Clean Sheet MCP reached at <ISO time>`. If the desktop labels differ, use the management request above; the documented key is authoritative.

## 2. Connect the complete stdio channel

Add `clean-sheet-stdio` using this config. Absolute paths make it independent of the desktop's working directory. Give this connector its own runtime so it does not compete with the HTTP server.

```json
{
  "command": "C:\\Program Files\\nodejs\\node.exe",
  "args": ["C:\\Users\\Woo\\OneDrive\\Documents\\SIT Fintech\\Hackathons\\QwenWork OPC\\Code\\clean-sheet-w2\\src\\mcp\\stdio.js"],
  "env": {
    "KEEPER_RUNTIME": "C:\\Users\\Woo\\OneDrive\\Documents\\SIT Fintech\\Hackathons\\QwenWork OPC\\Code\\clean-sheet-w2\\runtime\\qwenwork-stdio"
  }
}
```

Use the same add request as step 1 with the new name and config. Query `qwenwork.settings.connector.custom.clean-sheet-stdio`; verify all 11 tools. Ask the worker:

> Start a task as Support, instruction “Read the public website copy”, scope files [“marketing/website_about.md”]. Read that file using its returned task_id, then end the task. Use only Clean Sheet tools for this work.

`start_task` accepts optional `client` and `service` for quote context. Keep the returned `task_id` on subsequent calls. Without one, calls use the latest open task in that MCP session, or the task for the supplied `agent`; otherwise a default task is created with no declared scope. A closed or foreign-session task is rejected. `read_file` accepts `path` (or harness alias `file`); `list_files` accepts `folder` (or `path`). Other file arguments are workspace-relative paths.

## 3. Connect HTTP or legacy SSE

Start the server in a PowerShell terminal and leave it running:

```powershell
Set-Location 'C:\Users\Woo\OneDrive\Documents\SIT Fintech\Hackathons\QwenWork OPC\Code\clean-sheet-w2'
node src/mcp/http.js
```

Add `clean-sheet-http` with:

```json
{ "url": "http://127.0.0.1:8787/mcp" }
```

For a client that needs legacy SSE, add `clean-sheet-sse` instead:

```json
{ "url": "http://127.0.0.1:8787/sse" }
```

Use one of these connectors for a worker, then query its custom connector key and repeat the read task. The HTTP transport returns `MCP-Session-Id` on initialization; subsequent requests must send that header. The legacy SSE stream advertises `/messages?sessionId=...` itself. Do not configure `/messages` as the connector URL.

The default listener is `127.0.0.1:8787`; `PORT` and `HOST` override it. Cloud scheduled tasks need this HTTP server hosted at a public URL; a desktop localhost URL cannot serve them. Before public hosting, put authentication and owner/worker route separation in front of the service. This local demo deliberately has open CORS and no login. `/api/*` exposes owner evidence and approvals and must not be offered as worker tools or exposed publicly as-is. QwenWork's other connectors are outside this channel; this server does not intercept them.

## Console and demo commands

| Route | Result |
|---|---|
| `GET /api/events` | SSE: history first, then live contract events; SSE event name equals `type` |
| `GET /api/queue` | Pending actions with owner-only evidence |
| `POST /api/queue/:id/release` | Revalidate, refuse BLOCK, record owner approval, execute once |
| `POST /api/queue/:id/reject` | Record rejection without execution |
| `GET /api/scorecard` | In-memory W1 scenario and normal-action totals; no workspace effects |
| `GET /api/log/verify` | Hash-chain and persisted head verification |
| `GET /api/log` | Full owner-only audit rows, also used by the HTTP rogue scorer |
| `GET /api/briefing?date=2026-11-18` | Script and JSON counts; dates are UTC; omitted date uses latest log day |

Run one complete protocol demonstration:

```powershell
node scripts/rogue.js
node scripts/briefing.js
```

Or, with the HTTP server running on a fresh workspace:

```powershell
node scripts/rogue.js --http http://127.0.0.1:8787
```

The normal suite really deletes the Nimbus file received in error, so a second scored run needs a fresh runtime. Preserve the previous run and choose a new directory, for example:

```powershell
$env:KEEPER_RUNTIME = Join-Path $PWD ('runtime\take-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
node scripts/rogue.js
node scripts/briefing.js
```

For HTTP, set that environment variable before starting the server; the HTTP rogue client uses the running server's workspace. The first launch overlays both fixture data folders into the chosen workspace. Later launches retain workspace changes and restore queue and audit state. A writer lock prevents two servers from using the same runtime. Fixture data is never changed.

Replay a saved run on the same console routes, after stopping the live HTTP server:

```powershell
node scripts/replay.js runtime/events.jsonl --speed 4
```

Replay validates the saved hash chain, uses original timing divided by four, and serves `/api/events` at port 8787. Late viewers receive the history already replayed. It stays running until Ctrl+C, rejects POST operations, and neither executes actions nor appends to the source log. Use `PORT` for a separate replay listener.

## What execution means here

Allowed reads return copied file contents. Emails and R17 notifications are saved as JSON under `outbox/`; uploads copy files under `uploads/<action-id>/`; deletes remove the copied files. Quotes, terms, payments and orders produce JSON receipts under `actions/`. No external email, upload, payment or supplier service is contacted.

`events.jsonl` is also the hash-chained audit log: every decision and contract event has `time`, `seq`, `prev_hash`, and `hash`. `audit-head.json` anchors the current head locally. This detects accidental edits and truncation; it is not a separately trusted external anchor. Startup fails closed if verification fails. An interrupted or partially failed effect is logged for manual review, with no automatic retry that could duplicate spending.

Owner approval is an explicit exception for the exact held action after revalidation. It never overrides a new BLOCK. A worker receives no evidence objects; after a refused read its later action message is generic to avoid leaking private source text through the reason.

Tests: `npm test`. Deterministic engine score: `npm run score`. Verified locally through stdio, HTTP and legacy SSE; QwenWork desktop, public hosting and real delivery remain unverified.
