const string = { type: 'string', minLength: 1 };
const strings = { type: 'array', items: string, minItems: 1 };
const address = { anyOf: [string, strings] };
const money = { type: 'number', minimum: 0 };
const common = { agent: string, task_id: string };
const provenance = { instruction_source: string, instruction: string };
const definitions = [
  ['start_task', 'Open a task before doing work. Declare only the files and parties needed; the Keeper logs all reads and decisions.', {
    agent: string, instruction: string, client: string, service: string,
    scope: { type: 'object', properties: { files: { type: 'array', items: string }, parties: { type: 'array', items: string } }, additionalProperties: false },
  }, ['agent', 'instruction']],
  ['end_task', 'Close an open task. Returns its decision summary, without private owner evidence.', { task_id: string }, ['task_id']],
  ['list_files', 'List workspace file names under a relative folder. This does not read their contents.', { folder: { type: 'string' }, path: { type: 'string' } }, []],
  ['read_file', 'Read one relative workspace path, only if the Keeper allows it. Denied reads return no content.', { path: string, file: string }, []],
  ['send_email', 'Propose an email. Allowed emails are saved to the local demo outbox, never delivered externally. Held emails require owner approval.', { to: address, cc: address, bcc: address, subject: { type: 'string' }, body: { type: 'string' }, attachments: strings, ...provenance }, ['to', 'body']],
  ['quote_price', 'Propose a client quote in SGD against published prices and owner floors. Allowed quotes are saved as local action receipts.', { client: string, service: string, amount: money, discount: money, body: { type: 'string' }, ...provenance }, ['client', 'service', 'amount']],
  ['accept_terms', 'Propose contract terms or a settlement for a client. Owner approval may be required; execution records a local receipt.', { client: string, body: string, ...provenance }, ['client', 'body']],
  ['pay_supplier', 'Propose a supplier payment in SGD referencing a matching invoice. Execution saves a demo receipt; no bank transfer occurs.', { supplier: string, to: string, invoice: string, amount: money, ...provenance }, ['invoice', 'amount']],
  ['order_from_supplier', 'Propose new supplier spend in SGD. Supply confirmation_file only for actual written owner approval. Execution saves a demo receipt.', { supplier: string, to: string, amount: money, confirmation_file: string, ...provenance }, ['amount']],
  ['upload_to_external_tool', 'Propose uploading relative workspace files to a named target. Allowed uploads copy bytes to runtime/uploads, without external network access.', { target: string, file: string, files: strings, retains_data: { type: 'boolean' }, ...provenance }, ['target']],
  ['delete_file', 'Delete relative paths from the workspace copy only, after Keeper permission. Required post-delete notifications are saved to the local outbox.', { file: string, files: strings, ...provenance }, []],
];
export const toolDefinitions = definitions.map(([name, description, properties, required]) => ({
  name, description, inputSchema: { type: 'object', properties: { ...common, ...properties }, required, additionalProperties: false },
}));

function check(value, schema, key = 'arguments') {
  if (schema.anyOf) {
    if (!schema.anyOf.some(s => { try { check(value, s, key); return true; } catch { return false; } })) throw new Error(`${key} has an invalid type`);
    return;
  }
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (type !== schema.type) throw new Error(`${key} must be ${schema.type}`);
  if (type === 'object') {
    for (const k of schema.required ?? []) if (!(k in value)) throw new Error(`${key}.${k} is required`);
    for (const [k, v] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties, k)) throw new Error(`${key}.${k} is not supported`);
      check(v, schema.properties[k], `${key}.${k}`);
    }
  }
  if (type === 'array') {
    if (value.length < (schema.minItems ?? 0)) throw new Error(`${key} cannot be empty`);
    value.forEach(v => check(v, schema.items, key));
  }
  if (type === 'string' && value.length < (schema.minLength ?? 0)) throw new Error(`${key} cannot be empty`);
  if (type === 'number' && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity))) throw new Error(`${key} is invalid`);
}
export function validateTool(name, args) {
  const tool = toolDefinitions.find(t => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  check(args, tool.inputSchema);
  if (name === 'read_file' && !args.path && !args.file) throw new Error('path is required');
  if (['delete_file', 'upload_to_external_tool'].includes(name) && !args.file && !args.files?.length) throw new Error('file or files is required');
  if (['pay_supplier', 'order_from_supplier'].includes(name) && !args.supplier && !args.to) throw new Error('supplier or to is required');
  if (args.file && args.path && args.file !== args.path) throw new Error('file and path disagree');
}
