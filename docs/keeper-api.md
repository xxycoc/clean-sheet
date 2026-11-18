# Keeper engine integration

Node 24, ES modules, no dependencies. Run `npm test` and `node scripts/score.js` from the repository root.

```js
import { loadFixtures } from '../src/fixtures.js';
import { createKeeper } from '../src/keeper/engine.js';

const keeper = createKeeper(loadFixtures());
const task = {
  id: 'task-1', agent: 'Support', instruction: 'Reply to the supplier.',
  scope: { files: ['inbox/request.md'], parties: [] }, reads: [],
};
// Supply actual fixture paths, or inject your own plain file objects.
const read = keeper.decideRead(task, 'inbox/request.md');
const result = keeper.decideAction(task, {
  id: 'action-1', tool: 'send_email', args: { to: 'orders@example', body: 'Thank you.' },
});
```

`createKeeper({ files, policy, taxonomy, extraPolicy, ownerEmails? })` takes a path-keyed map of `{ path, header, body }` files. Parties are parsed from client CSV and supplier table contents. Explicit `ownerEmails` is recommended for production; the kit fallback reads an owner line matching `policy.owner` in a non-inbound document.

- `decideRead(task, fileOrPath)` returns a `file.read` event. Only return file contents to a worker if its decision is `ALLOW`.
- `decideAction(task, action)` returns a `keeper.decision` with `proposed` and `events: [action.proposed, keeper.decision]` for adapters.
- `runTask(task, steps)` returns `decision`, union `rules`, highest `data_level`, `evidence`, hashed `events`, `owner_messages`, `obligations`, and an `AuditLog` instance as `log`.
- Standalone exports with the same names take context as their third argument, or use `task.context`. Factory methods need only the two contract arguments.
- `scope.files` accepts exact paths or directory prefixes ending `/`; `scope.parties` accepts known party names. No scope is assumed when neither is present.
- A streaming adapter must maintain `task.reads` itself, including blocked requests conservatively. `runTask` maintains that state locally and does not mutate the supplied task.
- One task with several proposed actions uses their strictest outcome. If there is no action, it uses the strictest read. Read violations always remain in the union of rules and audit log.

## Structured action arguments

| Tool | Arguments |
| --- | --- |
| `read_file` | `file` |
| `send_email` | `to` (string or array), `body`, optional `cc`, `bcc`, `attachments` |
| `quote_price` | `client`, `service`, `amount`, optional `discount`, `body` |
| `accept_terms` | `client`, `body` |
| `pay_supplier` | `supplier` or `to`, `invoice`, `amount` |
| `order_from_supplier` | `supplier` or `to`, `amount`, optional `confirmation_file` |
| `upload_to_external_tool` | `target`, `file` or `files`, `retains_data` |
| `delete_file` | `file` or `files` |

Optional `instruction_source` and `instruction` carry instruction provenance. Known email commitment phrases are also interpreted as quotes, orders or term changes; adapters should use structured tools whenever possible. `list_files` is a harness metadata operation, not a content read.

The engine makes decisions only. It never sends mail, deletes data, transfers money, or invokes an LLM. The channel must execute only `ALLOW`, queue `HOLD_FOR_APPROVAL`, and refuse `BLOCK`. A held action needs revalidation before execution. Do not feed owner-facing evidence containing private source text back to a worker whose read was denied.

R17 returns `notify_client` and `notify_owner` obligations with `after: successful_deletion`. The channel performs and logs these after a successful deletion. Their presence does not mean notifications have been sent.

## Audit and verification

`new AuditLog(clock?)` accepts an optional function returning an ISO timestamp. `append(event)` returns a detached row with `time`, `seq`, `prev_hash`, and its own SHA-256 `hash`. Exported `verify(rows, expectedHead?)` checks canonical JSON hashes and sequence linkage. Keep a trusted head outside the log to detect suffix truncation or complete rewriting; persist rows in the channel's database. In-memory rows cannot be modified through the public API.

The scorer checks decision, inclusion of every expected rule, and every named file/key figure in `tests/evidence_expectations.json`, transcribed from the scenario prose. Extra rule citations are warnings, not deductions. Evidence is computed by the engine; the harness contains only tasks and tool calls.
