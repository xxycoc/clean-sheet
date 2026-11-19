import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, lstatSync, unlinkSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { loadFixtures, parseFile } from '../fixtures.js';
import { createKeeper } from '../keeper/engine.js';
import { AuditLog, verify } from '../keeper/log.js';
import { highest, labelFile } from '../keeper/labels.js';
import { strictest } from '../keeper/policy.js';
import { validateTool } from './tools.js';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const defaultRuntime = () => resolve(process.env.KEEPER_RUNTIME ?? join(projectRoot, 'runtime'));
export const result = (text, data = {}, isError = false) => ({ content: [{ type: 'text', text }], structuredContent: data, ...(isError ? { isError: true } : {}) });
export const readRows = path => existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : [];

export class Channel extends EventEmitter {
  constructor({ runtime = defaultRuntime() } = {}) {
    super();
    this.runtime = resolve(runtime);
    mkdirSync(this.runtime, { recursive: true });
    this.lock = join(this.runtime, 'server.lock');
    if (existsSync(this.lock)) {
      const pid = Number(readFileSync(this.lock, 'utf8'));
      let alive = true;
      try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
      if (alive) throw new Error('This runtime already has a server. Use KEEPER_RUNTIME for a separate run.');
      unlinkSync(this.lock);
    }
    const fd = openSync(this.lock, 'wx');
    writeFileSync(fd, String(process.pid)); closeSync(fd);
    try {
      this.workspace = join(this.runtime, 'workspace');
      this.eventsPath = join(this.runtime, 'events.jsonl');
      this.headPath = join(this.runtime, 'audit-head.json');
      this.audit = new AuditLog();
      const rows = readRows(this.eventsPath);
      const head = existsSync(this.headPath) ? JSON.parse(readFileSync(this.headPath, 'utf8')).head : undefined;
      if (!verify(rows, head) || (rows.length && head === undefined)) throw new Error('Audit verification failed; preserve the runtime for inspection.');
      for (const { time, seq, prev_hash, hash, ...event } of rows) {
        this.auditClock = time;
        if (!this.restored) { this.audit = new AuditLog(() => this.auditClock ?? new Date().toISOString()); this.restored = true; }
        this.audit.append(event);
      }
      this.auditClock = undefined;
      // Seed once: restarting must not resurrect deleted files or discard the owner's approved changes.
      if (!existsSync(this.workspace)) {
        mkdirSync(this.workspace, { recursive: true });
        for (const base of ['fixtures/starter-kit/data', 'fixtures/extra/data']) this.copyTree(join(projectRoot, base), this.workspace);
      }
      for (const folder of ['outbox', 'uploads', 'actions']) mkdirSync(join(this.runtime, folder), { recursive: true });
      this.tasks = new Map(); this.active = new Map(); this.queue = new Map();
      for (const row of rows) {
        if (row.type === 'task.started') this.tasks.set(row.task_id, { ...row.task, reads: [], observed_files: {} });
        if (row.type === 'file.read') {
          const task = this.tasks.get(row.task_id);
          if (task && !task.reads.includes(row.file)) task.reads.push(row.file);
          if (task && row.observed_file) task.observed_files[row.file] = row.observed_file;
        }
        if (row.type === 'task.ended' && this.tasks.has(row.task_id)) this.tasks.get(row.task_id).closed = true;
        if (row.type === 'approval.queued') this.queue.set(row.id, row.entry);
        if (row.type === 'owner.decision' && this.queue.has(row.id)) this.queue.get(row.id).status = row.released ? 'released' : 'rejected';
        if (row.type === 'action.failed' && this.queue.has(row.id)) this.queue.get(row.id).status = 'failed';
      }
      for (const task of this.tasks.values()) if (!task.closed) {
        this.active.set(`${task.session}:${task.agent}`, task.id); this.active.set(task.session, task.id);
      }
      this.refresh();
    } catch (error) { this.close(); throw error; }
  }
  close() { if (this.lock && existsSync(this.lock)) unlinkSync(this.lock); this.lock = null; }
  copyTree(from, to) {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const destination = join(to, entry.name);
      if (entry.isDirectory()) { mkdirSync(destination, { recursive: true }); this.copyTree(join(from, entry.name), destination); }
      else copyFileSync(join(from, entry.name), destination);
    }
  }
  safePath(path, allowFolder = false) {
    if (typeof path !== 'string' || /[\x00-\x1f:]/.test(path) || isAbsolute(path) || path.includes('\\') || path.split('/').includes('..')) throw new Error('Use a relative workspace path without traversal');
    const target = resolve(this.workspace, path);
    const rel = relative(this.workspace, target);
    if (rel.startsWith('..') || isAbsolute(rel) || (!allowFolder && !rel)) throw new Error('Path is outside the workspace');
    let current = this.workspace;
    if (lstatSync(current).isSymbolicLink()) throw new Error('Workspace links are not allowed');
    for (const part of rel.split(/[\\/]/).filter(Boolean)) {
      current = join(current, part);
      if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('Workspace links are not allowed');
    }
    if (existsSync(target)) {
      const resolved = relative(realpathSync(this.workspace), realpathSync(target));
      if (resolved.startsWith('..') || isAbsolute(resolved)) throw new Error('Path is outside the workspace');
      if (!allowFolder && !lstatSync(target).isFile()) throw new Error('Expected a file');
    }
    return target;
  }
  refresh() {
    const fixtures = loadFixtures();
    const files = {};
    const walk = (folder, prefix = '') => {
      for (const item of readdirSync(folder, { withFileTypes: true })) {
        if (item.isSymbolicLink()) continue;
        const key = `${prefix}${item.name}`;
        if (item.isDirectory()) walk(join(folder, item.name), `${key}/`);
        else files[key] = parseFile(key, readFileSync(this.safePath(key), 'utf8'));
      }
    };
    walk(this.workspace);
    this.keeper = createKeeper({ ...fixtures, files });
  }
  emitEvent(event) {
    const row = this.audit.append(event);
    appendFileSync(this.eventsPath, `${JSON.stringify(row)}\n`);
    writeFileSync(this.headPath, JSON.stringify({ count: this.audit.rows.length, head: row.hash }));
    this.emit('event', row);
    return row;
  }
  verifyLog() {
    try { const rows = readRows(this.eventsPath); const head = existsSync(this.headPath) ? JSON.parse(readFileSync(this.headPath, 'utf8')).head : null;
      return { valid: verify(rows, head) && head === this.audit.head, rows: rows.length, head };
    } catch { return { valid: false }; }
  }
  start(args, session) {
    const task = { id: randomUUID(), session, agent: args.agent, instruction: args.instruction, scope: args.scope ?? {}, reads: [], observed_files: {}, ...(args.client ? { client: args.client } : {}), ...(args.service ? { service: args.service } : {}) };
    this.tasks.set(task.id, task); this.active.set(`${session}:${task.agent}`, task.id); this.active.set(session, task.id);
    this.emitEvent({ type: 'task.started', task_id: task.id, agent: task.agent, instruction: task.instruction, scope: task.scope, task });
    return task;
  }
  getTask(args, session) {
    const id = args.task_id ?? this.active.get(args.agent ? `${session}:${args.agent}` : session);
    const task = this.tasks.get(id);
    if (args.task_id && (!task || task.closed || task.session !== session || (args.agent && task.agent !== args.agent))) throw new Error('Task is not open in this session');
    if (task && !task.closed && task.session === session) return task;
    return this.start({ agent: args.agent ?? 'Worker', instruction: 'Default task; no scope declared.' }, session);
  }
  summary(id) {
    const rows = this.audit.rows.filter(e => e.task_id === id);
    const actions = rows.filter(e => e.type === 'keeper.decision' && !e.revalidation);
    const reads = rows.filter(e => e.type === 'file.read');
    return { task_id: id, decision: strictest((actions.length ? actions : reads).map(e => e.decision)), rules: [...new Set([...reads, ...actions].flatMap(e => e.rules ?? []))] };
  }
  actionKeeper(task, action) {
    const files = { ...this.keeper.context.files };
    const args = action.args;
    const targets = new Set([args.file, args.invoice, args.confirmation_file, args.instruction_source, ...(args.files ?? []), ...(args.attachments ?? [])]);
    // A successful deletion must not erase the sensitivity of material already read.
    // Do not resurrect a missing execution target: W1 must still reject that action.
    for (const [path, file] of Object.entries(task.observed_files ?? {})) {
      if (files[path]) {
        const level = highest([labelFile(files[path], this.keeper.context).level, file.header.sensitivity], this.keeper.context.taxonomy);
        files[path] = { ...files[path], header: { ...files[path].header, sensitivity: level } };
      } else if (!targets.has(path)) files[path] = file;
    }
    return createKeeper({ ...this.keeper.context, files });
  }
  call(name, input = {}, session = 'stdio') {
    validateTool(name, input);
    const args = structuredClone(input);
    if (name === 'start_task') { const task = this.start(args, session); return result(`Task started: ${task.id}`, { task_id: task.id }); }
    const task = this.getTask(args, session);
    if (name === 'end_task') {
      task.closed = true; const summary = this.summary(task.id);
      this.emitEvent({ type: 'task.ended', agent: task.agent, ...summary });
      return result(`Task ended: ${summary.decision}`, summary);
    }
    delete args.agent; delete args.task_id;
    if (name === 'read_file') { args.file = args.path ?? args.file; delete args.path; }
    if (name === 'list_files') {
      const folder = args.folder ?? args.path ?? '';
      this.safePath(folder, true); this.refresh();
      const prefix = folder.replace(/\/$/, '');
      const files = Object.keys(this.keeper.context.files).filter(p => !prefix || p === prefix || p.startsWith(`${prefix}/`));
      this.emitEvent({ type: 'directory.listed', task_id: task.id, agent: task.agent, path: folder, files });
      return result(JSON.stringify(files), { files });
    }
    for (const path of [args.file, args.invoice, args.confirmation_file, args.instruction_source, ...(args.files ?? []), ...(args.attachments ?? [])].filter(Boolean)) this.safePath(path);
    this.refresh();
    if (name === 'read_file') {
      const decision = this.keeper.decideRead(task, args.file);
      const observed = this.keeper.context.files[args.file];
      if (observed) {
        const level = highest([decision.level, task.observed_files[args.file]?.header.sensitivity], this.keeper.context.taxonomy);
        task.observed_files[args.file] = { ...structuredClone(observed), header: { ...observed.header, sensitivity: level } };
      }
      this.emitEvent({ ...decision, ...(observed ? { trust: observed.header.trust ?? null, observed_file: task.observed_files[args.file] } : {}) });
      if (!task.reads.includes(args.file)) task.reads.push(args.file);
      const data = { task_id: task.id, decision: decision.decision, rules: decision.rules };
      if (decision.decision !== 'ALLOW') return result('Blocked by the Keeper: This file is unavailable or outside the permitted task scope. No file content was returned.', data, true);
      return result(readFileSync(this.safePath(args.file), 'utf8'), data);
    }
    const action = { id: randomUUID(), tool: name, args };
    const decision = this.actionKeeper(task, action).decideAction(task, action);
    decision.events.forEach(e => this.emitEvent(e));
    const data = { id: action.id, task_id: task.id, decision: decision.decision, rules: decision.rules };
    // Owner evidence may contain denied source text. Workers get a generic message if any read was refused.
    const denied = this.audit.rows.some(e => e.type === 'file.read' && e.task_id === task.id && e.decision !== 'ALLOW');
    const reason = denied ? 'The proposed action needs review under the owner policy. No private source content is returned.' : decision.owner_message;
    if (decision.decision === 'BLOCK') return result(`Blocked by the Keeper: ${reason}`, data, true);
    if (decision.decision === 'HOLD_FOR_APPROVAL') {
      const entry = { id: action.id, task: structuredClone(task), action, decision, status: 'pending' };
      this.queue.set(action.id, entry);
      this.emitEvent({ type: 'approval.queued', id: action.id, task_id: task.id, entry });
      return result(`Held for the owner's approval: ${reason}`, data, true);
    }
    return result('Allowed and executed in the local workspace.', { ...data, result: this.execute(task, action, decision) });
  }
  execute(task, action, decision) {
    const { id, tool, args } = action;
    try {
      const paths = [...new Set([args.file, ...(args.files ?? []), ...(args.attachments ?? [])].filter(Boolean))];
      const contents = paths.map(path => ({ path, content: readFileSync(this.safePath(path), 'utf8') }));
      let output;
      if (tool === 'delete_file') {
        for (const path of paths) unlinkSync(this.safePath(path));
        output = { deleted: paths };
      } else if (tool === 'upload_to_external_tool') {
        const folder = join(this.runtime, 'uploads', id); mkdirSync(folder);
        for (const path of paths) { const target = join(folder, path); mkdirSync(dirname(target), { recursive: true }); copyFileSync(this.safePath(path), target); }
        writeFileSync(join(folder, 'receipt.json'), JSON.stringify({ id, tool, args }, null, 2));
        output = { saved: `uploads/${id}`, external_delivery: false };
      } else {
        const folder = tool === 'send_email' ? 'outbox' : 'actions';
        writeFileSync(join(this.runtime, folder, `${id}.json`), JSON.stringify({ id, tool, args, attachments: contents, demo: true }, null, 2), { flag: 'wx' });
        output = { saved: `${folder}/${id}.json`, external_delivery: false };
      }
      this.emitEvent({ type: 'action.executed', id, task_id: task.id, agent: task.agent, tool, result: output });
      for (const obligation of decision.obligations ?? []) {
        if (obligation.after !== 'successful_deletion' || tool !== 'delete_file') continue;
        const notificationId = randomUUID();
        writeFileSync(join(this.runtime, 'outbox', `${notificationId}.json`), JSON.stringify({ id: notificationId, to: obligation.to, subject: 'Data received in error deleted', body: `Deleted ${obligation.file} from the local workspace.`, obligation, demo: true }, null, 2));
        this.emitEvent({ type: 'notification.queued', id: notificationId, action_id: id, task_id: task.id, obligation, external_delivery: false });
      }
      this.refresh(); return output;
    } catch (error) {
      this.emitEvent({ type: 'action.failed', id, task_id: task.id, tool, message: error.message });
      throw error;
    }
  }
  decideQueue(id, released) {
    const entry = this.queue.get(id);
    if (!entry || entry.status !== 'pending') throw new Error('No pending approval with that id');
    let decision = entry.decision;
    if (released) {
      this.refresh();
      const task = this.tasks.get(entry.task.id) ?? entry.task;
      decision = this.actionKeeper(task, entry.action).decideAction(task, entry.action);
      this.emitEvent({ ...decision.events[1], revalidation: true });
      if (decision.decision === 'BLOCK') throw new Error('Release refused: the current Keeper decision is BLOCK');
      for (const path of [entry.action.args.file, entry.action.args.invoice, entry.action.args.confirmation_file, ...(entry.action.args.files ?? []), ...(entry.action.args.attachments ?? [])].filter(Boolean)) this.safePath(path);
    }
    this.emitEvent({ type: 'owner.decision', id, task_id: entry.task.id, released, by: 'owner' });
    entry.status = released ? 'released' : 'rejected';
    if (!released) return { id, status: entry.status };
    try { return { id, status: entry.status, result: this.execute(entry.task, entry.action, decision) }; }
    catch (error) { entry.status = 'failed'; throw error; }
  }
}
