import { loadParties, emails } from './parties.js';
import { labelFile, labelOutgoing, highest } from './labels.js';
import { inScope } from './scope.js';
import { matchPolicy, ruleDecision, strictest } from './policy.js';
import { ownerMessage } from './messages.js';
import { AuditLog } from './log.js';

export function createKeeper(input) {
  const context = { ...input, parties: input.parties ?? loadParties(input.files) };
  context.ownerEmails = input.ownerEmails ?? [...new Set(Object.values(input.files)
    .filter(f => !f.header.from && f.header.trust !== 'untrusted')
    .flatMap(f => f.body.split(/\r?\n/).filter(line => /^Owner:/i.test(line) && line.includes(input.policy.owner)).flatMap(emails)))];

  function decideRead(task, fileOrPath) {
    const file = typeof fileOrPath === 'string' ? context.files[fileOrPath] : fileOrPath;
    if (!file) return { type: 'file.read', task_id: task.id, agent: task.agent, file: fileOrPath, level: null, in_scope: false, decision: 'BLOCK', rules: [], evidence: [{ source: fileOrPath, claim: 'missing file', value: null, text: 'File not found.' }] };
    const label = labelFile(file, context);
    const in_scope = inScope(task, file, context.parties);
    const rules = !in_scope && label.level === 'regulated' ? ['R02'] : ['R01'];
    return { type: 'file.read', task_id: task.id, agent: task.agent, file: file.path, level: label.level,
      in_scope, scope_creep: !in_scope, decision: strictest(rules.map(r => ruleDecision(r, context))), rules,
      evidence: [...label.evidence, { source: file.path, claim: 'task scope', value: in_scope, text: in_scope ? 'Needed for the declared task.' : 'Outside the declared task scope.' }] };
  }
  function decideAction(task, action) {
    // Retain material seen before a file was replaced or deleted, as well as current content.
    const readFiles = (task.reads ?? []).flatMap(path => [context.files[path], task.observed_files?.[path]]).filter(Boolean);
    const args = action.args ?? {};
    const attachments = [...new Set([args.file, ...(args.files ?? []), ...(args.attachments ?? [])].filter(Boolean))].map(path => context.files[path]).filter(Boolean);
    const recipients = [...emails(args.to), ...emails(args.cc), ...emails(args.bcc)];
    // Routing and provenance metadata do not travel as message content.
    const { to, cc, bcc, file, files, attachments: attachedPaths, instruction_source, confirmation_file, ...payload } = args;
    const label = labelOutgoing(Object.values(payload).map(value => typeof value === 'string' ? value : JSON.stringify(value)).join('\n'),
      readFiles, attachments, context, recipients);
    const proposed = { type: 'action.proposed', id: action.id ?? `${task.id}-action`, task_id: task.id, agent: task.agent,
      tool: action.tool, args: structuredClone(args), level: label.level, inherited_from: label.inherited_from };
    const result = matchPolicy(task, action, label, context);
    const readDecisions = (task.reads ?? []).map(path => decideRead(task, path));
    result.scope_creep = readDecisions.filter(read => !read.in_scope).map(read => read.file);
    result.blocked_reads = readDecisions.filter(read => read.decision === 'BLOCK').map(read => read.file);
    const decision = { type: 'keeper.decision', id: proposed.id, task_id: task.id, agent: task.agent,
      decision: result.decision, rules: result.rules, data_level: label.level, evidence: result.evidence,
      obligations: result.obligations, owner_message: ownerMessage(task, action, result) };
    return { ...decision, proposed, events: [proposed, decision] };
  }
  function runTask(task, steps) {
    const state = { ...structuredClone(task), reads: [...(task.reads ?? [])] };
    const log = new AuditLog();
    const events = [];
    const emit = event => { events.push(log.append(event)); };
    emit({ type: 'task.started', task_id: task.id, agent: task.agent, instruction: task.instruction, scope: task.scope });
    const reads = [], decisions = [];
    for (const [index, step] of steps.entries()) {
      if (step.tool === 'read_file') {
        const read = decideRead(state, step.args.file);
        reads.push(read); emit(read);
        // Keep attempted blocked reads in provenance conservatively, without exposing their contents to a worker.
        if (context.files[step.args.file] && !state.reads.includes(step.args.file)) state.reads.push(step.args.file);
      } else if (step.tool === 'list_files') {
        emit({ type: 'directory.listed', task_id: task.id, agent: task.agent, path: step.args.path,
          files: Object.keys(context.files).filter(p => p.startsWith(step.args.path)) });
      } else {
        const result = decideAction(state, { ...step, id: step.id ?? `${task.id}-a${index + 1}` });
        decisions.push(result);
        result.events.forEach(emit);
      }
    }
    const outcome = decisions.length ? strictest(decisions.map(d => d.decision)) : strictest(reads.map(r => r.decision));
    return { task_id: task.id, decision: outcome,
      rules: [...new Set([...reads, ...decisions].flatMap(e => e.rules))],
      data_level: highest([...reads.map(r => r.level), ...decisions.map(d => d.data_level)], context.taxonomy),
      evidence: [...reads, ...decisions].flatMap(e => e.evidence), events, log,
      owner_messages: decisions.map(d => d.owner_message), obligations: decisions.flatMap(d => d.obligations) };
  }
  return { decideRead, decideAction, runTask, context };
}

// Standalone helpers keep the core usable without global state or filesystem access.
export const decideRead = (task, file, context) => createKeeper(context ?? task.context).decideRead(task, file);
export const decideAction = (task, action, context) => createKeeper(context ?? task.context).decideAction(task, action);
export const runTask = (task, steps, context) => createKeeper(context ?? task.context).runTask(task, steps);
