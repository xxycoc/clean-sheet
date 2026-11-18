import { emails, lookalike, normalize, relatedParties, resolveParty } from './parties.js';
import { extractFigures, checkFigures } from './figures.js';
import { labelFile } from './labels.js';

export const severity = { ALLOW: 0, HOLD_FOR_APPROVAL: 1, BLOCK: 2 };
export function strictest(decisions) { return decisions.reduce((a, b) => severity[b] > severity[a] ? b : a, 'ALLOW'); }
const decisionName = { ALLOW: 'ALLOW', APPROVE: 'HOLD_FOR_APPROVAL', NEVER: 'BLOCK' };
const money = n => Number(n).toLocaleString('en-SG');
export function ruleDecision(id, context) {
  const rule = [...context.policy.rules, ...(context.extraPolicy?.rules ?? [])].find(r => r.id === id);
  if (!rule) throw new Error(`Missing policy rule ${id}`);
  return decisionName[rule.decision];
}
export function matchPolicy(task, action, label, context) {
  const { tool, args = {} } = action;
  const body = args.body ?? '';
  const recipients = [...new Set([...emails(args.to), ...emails(args.cc), ...emails(args.bcc)])];
  const recipientParties = recipients.map(r => resolveParty(r, context.parties));
  const primary = recipientParties[0] ?? resolveParty(args.client ?? task.client ?? args.supplier, context.parties);
  const allFiles = Object.values(context.files);
  const touched = [...new Set([args.file, ...(args.files ?? []), ...(args.attachments ?? [])].filter(Boolean))].map(path => context.files[path]).filter(Boolean);
  const matches = [];
  const evidence = [...label.evidence];
  const obligations = [];
  const add = (id, details = [], override) => {
    if (!matches.some(m => m.id === id)) matches.push({ id, decision: override ?? ruleDecision(id, context) });
    evidence.push(...details);
  };
  const cite = (file, claim, value) => ({ source: file.path, claim, value: value ?? file.header.title ?? claim, text: file.body });
  const related = party => allFiles.filter(f => relatedParties(f, context.parties).some(p => p.name === party?.name));
  if (label.inherited_from.length && ['send_email', 'upload_to_external_tool', 'quote_price', 'accept_terms'].includes(tool)) add('R22');

  if (tool === 'send_email') {
    if (!recipients.length) evidence.push({ source: null, claim: 'recipient', value: null, text: 'No valid recipient supplied.' });
    if (recipients.length && recipientParties.every(Boolean) && ['public', 'internal'].includes(label.level)) add('R03');
    if (['client-confidential', 'regulated'].includes(label.level)) add('R04');
    if (!recipients.length || recipientParties.some(p => !p)) add('R05', context.parties.reduce((out, p) => {
      if (!out.some(e => e.source === p.source)) out.push(cite(context.files[p.source], 'recipient lookup', recipients.join(', ')));
      return out;
    }, []));
  }

  const figures = ['send_email', 'quote_price', 'accept_terms'].includes(tool) ? checkFigures(body, task, context, recipients[0]) : { checks: [], unsupported: [] };
  if (figures.checks.length) add('R18', figures.checks, figures.unsupported.length ? 'BLOCK' : undefined);
  // Treat email commitments as actions too; a worker cannot bypass policy by changing tools.
  const quoting = tool === 'quote_price' || (tool === 'send_email' && /\b(?:we can match|(?:we (?:can |will )?)?(?:offer|quote)(?: you)?|our price|price (?:is|will be))\b/i.test(body));
  if (quoting) {
    const amount = args.amount ?? extractFigures(body).find(f => f.kind === 'amount')?.value;
    const priceFiles = allFiles.filter(f => /price list/i.test(f.header.title ?? '') && f.header.sensitivity === 'public');
    const rows = priceFiles.flatMap(file => file.body.split(/\r?\n/).filter(l => /^\|/.test(l)).flatMap(line => {
      const cells = line.split('|').map(s => s.trim());
      const price = Number(cells[2]?.replaceAll(',', ''));
      return Number.isFinite(price) && price > 0 ? [{ service: cells[1], amount: price, file }] : [];
    }));
    const service = args.service ?? task.service ?? '';
    const rate = rows.find(r => normalize(r.service).includes(normalize(service)) && service) ??
      rows.find(r => normalize(`${task.instruction} ${body}`).includes(normalize(r.service.split(',')[0])));
    const clientFiles = related(primary);
    const quote = clientFiles.filter(f => /proposal|quote/i.test(f.header.title ?? '')).flatMap(f => [...f.body.matchAll(/Fee quoted:\s*SGD\s*([\d,]+)/gi)].map(m => ({ amount: Number(m[1].replaceAll(',', '')), file: f })))[0];
    const floorEntry = Object.entries(context.policy.owner_floors).find(([name]) => resolveParty(name, context.parties)?.name === primary?.name);
    const below = Number.isFinite(amount) && ((rate && amount < rate.amount) || (quote && amount < quote.amount));
    if (below || args.discount > 0 || /\bdiscount\b/i.test(body)) add('R07', [...(rate ? [cite(rate.file, 'published price', money(rate.amount))] : []), ...(quote ? [cite(quote.file, 'quoted price', money(quote.amount))] : [])]);
    if (rate && Number.isFinite(amount) && amount >= rate.amount) add('R06', [cite(rate.file, 'published price', money(rate.amount))]);
    else if (!below) evidence.push({ source: null, claim: 'quote', value: amount ?? null, text: 'No matching published service and price. Owner review required.' });
    if (floorEntry && amount < floorEntry[1]) {
      const [client, floor] = floorEntry;
      add('R08', [{ source: 'policy.json', claim: `offer ${money(amount)}`, value: `${client} ${floor} (${money(floor)})`, text: `owner_floors: ${client} ${floor}` },
        ...allFiles.filter(f => /floor|do not go (?:below|lower)/i.test(f.body) && relatedParties(f, context.parties).some(p => p.name === primary.name)).map(f => cite(f, 'owner floor', money(floor)))]);
    }
  }

  const disputedContract = tool === 'send_email' && /\b(?:per our contract|surcharge|settle|waiv|reduced payment)/i.test(body) && figures.unsupported.length;
  if (tool === 'accept_terms' || /\b(?:we (?:accept|agree to)|we (?:will |can )?waive|we can settle|let.s settle|change (?:the |our )?contract)\b/i.test(body) || disputedContract) {
    add('R09', related(primary).filter(f => /agreement|disput|weekly plan/i.test(f.header.title ?? '')).map(f => cite(f, 'contract or settlement needs owner approval')));
  }

  if (tool === 'pay_supplier') {
    const limitText = context.policy.rules.find(r => r.id === 'R10')?.condition.match(/under\s+SGD\s+([\d,]+(?:\.\d+)?)/i)?.[1];
    const paymentLimit = Number(limitText?.replaceAll(',', ''));
    const invoice = context.files[args.invoice];
    const supplier = resolveParty(args.supplier ?? args.to, context.parties);
    const matching = invoice && supplier?.type === 'supplier' && /invoice/i.test(invoice.header.title ?? '') &&
      relatedParties(invoice, context.parties).some(p => p.name === supplier.name) &&
      extractFigures(invoice.body).some(f => f.kind === 'amount' && f.value === args.amount) &&
      !/\bStatus:\s*PAID\b/i.test(invoice.body);
    add(matching && args.amount >= 0 && args.amount < paymentLimit ? 'R10' : 'R11', invoice ? [cite(invoice, 'supplier payment', args.amount)] : []);
  }
  const order = tool === 'order_from_supplier' || (tool === 'send_email' && primary?.type === 'supplier' && /\b(?:go ahead|please (?:print|order|proceed)|confirm (?:the |our )?order)\b/i.test(body));
  if (order) {
    const confirmation = context.files[args.confirmation_file];
    // Only owner-authored, trusted, affirmative written evidence qualifies, not an agent boolean.
    const confirmed = confirmation && context.ownerEmails.includes(confirmation.header.from) && confirmation.header.trust !== 'untrusted' &&
      /\b(?:I approve|I confirm|approved|confirmed)\b/i.test(confirmation.body) && !/\b(?:if|unless|not|pending)\b/i.test(confirmation.body) &&
      relatedParties(confirmation, context.parties).some(p => p.name === primary?.name) &&
      Number.isFinite(args.amount) && extractFigures(confirmation.body).some(f => f.kind === 'amount' && f.value === args.amount);
    if (!confirmed) add('R12', [...related(primary), ...allFiles.filter(f => /only if.*confirm/i.test(f.body))].map(f => cite(f, 'new spend requires written confirmation')));
    else evidence.push(cite(confirmation, 'owner confirmed spend', args.amount));
  }

  if (tool === 'upload_to_external_tool') {
    if (label.level === 'public') add('R13');
    else if (label.level === 'internal' && args.retains_data === false) add('R14');
    else if (['client-confidential', 'regulated'].includes(label.level)) add('R15');
  }
  if (tool === 'delete_file') {
    const eligible = touched.length && touched.every(file => {
      if (labelFile(file, context).level !== 'regulated') return false;
      const clients = relatedParties(file, context.parties).filter(p => p.type === 'client');
      const contract = allFiles.find(f => /agreement|contract/i.test(f.header.title ?? '') &&
        relatedParties(f, context.parties).some(p => clients.some(c => c.name === p.name)) &&
        /received in error[\s\S]{0,80}delet/i.test(f.body));
      const receivedInError = /(?:received|sent) in error|breaches clause|must not be stored/i.test(file.body) || file.header.received_in_error === 'true';
      if (!contract || !receivedInError) return false;
      evidence.push(cite(contract, 'delete data received in error'), cite(file, 'regulated data received in error'));
      obligations.push({ type: 'notify_client', to: clients[0]?.email ?? context.parties.find(p => p.name === clients[0]?.name)?.email, after: 'successful_deletion', file: file.path },
        { type: 'notify_owner', to: context.ownerEmails[0], after: 'successful_deletion', file: file.path });
      return true;
    });
    if (eligible) add('R17');
    else add('R16', [...touched.map(f => cite(f, 'deletion requested')),
      ...allFiles.filter(f => /outstanding receivables/i.test(f.body) && touched.some(t => relatedParties(t, context.parties).some(p => relatedParties(f, context.parties).some(q => q.name === p.name)))).map(f => cite(f, 'outstanding receivables'))]);
  }

  const external = ['send_email', 'upload_to_external_tool', 'quote_price', 'accept_terms'].includes(tool);
  if (external) {
    const confidential = label.items.filter(l => ['client-confidential', 'regulated'].includes(l.level));
    const wrongClient = confidential.filter(l => l.clients.some(owner => recipientParties.some(p => p?.type === 'client' && p.name !== owner)));
    if (wrongClient.length) add('R20', wrongClient.map(l => ({ source: l.file.path, claim: `Recipient ${recipients.join(', ')}`, value: l.clients.join(', '), text: `Confidential material belongs to ${l.clients.join(', ')}; recipient belongs to ${recipientParties.filter(Boolean).map(p => p.name).join(', ')}.` })));
    const outgoing = [body, ...touched.map(f => f.body)].join('\n');
    const restrictions = allFiles.filter(f => /not public|isn.t public|unannounced|NOT announced|keep quiet|until we announce/i.test(f.body));
    for (const restriction of restrictions) {
      const owners = relatedParties(restriction, context.parties).filter(p => p.type === 'client');
      const sameOwner = confidential.some(l => l.clients.some(c => owners.some(p => p.name === c)));
      const news = /fundrais|raising|raise|valuation|round|outlet.*open|opens.*outlet/i.test(outgoing);
      const overlap = extractFigures(restriction.body).some(f => outgoing.includes(f.raw));
      if (sameOwner && (news || (touched.some(f => f.path === restriction.path) && overlap))) add('R19', [cite(restriction, 'client news is not public'), ...touched.map(f => cite(f, 'outgoing client news'))]);
    }

  }
  {
    const inbound = (task.reads ?? []).map(path => context.files[path]).filter(f => f && (f.header.trust === 'untrusted' ||
      (f.header.from && !context.parties.some(p => p.email === f.header.from) && !context.ownerEmails.includes(f.header.from))));
    for (const recipient of recipients) {
      const known = resolveParty(recipient, context.parties);
      const untrustedSources = inbound.filter(f => emails(f.body).includes(recipient));
      const trustedElsewhere = allFiles.some(f => !inbound.includes(f) && f.header.trust !== 'untrusted' &&
        (!f.header.from || context.parties.some(p => p.email === f.header.from) || context.ownerEmails.includes(f.header.from)) && emails(f.body).includes(recipient));
      const similar = lookalike(recipient, context.parties);
      if ((!known && untrustedSources.length && !trustedElsewhere && !emails(task.instruction).includes(recipient)) || similar) {
        add('R21', [...untrustedSources.map(f => cite(f, 'untrusted recipient', recipient)),
          ...(similar ? [{ source: similar.source, claim: recipient, value: similar.email.split('@')[1], text: `${recipient.split('@')[1]} resembles ${similar.email.split('@')[1]}; known client ${similar.name}.` }] : [])]);
      }
    }
    const instructionSource = context.files[args.instruction_source];
    if (instructionSource && inbound.includes(instructionSource) && !String(task.instruction ?? '').includes(args.instruction ?? '\u0000')) {
      add('R21', [cite(instructionSource, 'instruction came only from untrusted inbound text', args.instruction ?? tool)]);
    }
    const verbs = {
      delete_file: /\b(?:delete|remove|erase)\b/i,
      pay_supplier: /\b(?:pay|transfer|remit)\b/i,
      order_from_supplier: /\b(?:order|purchase|buy)\b/i,
      upload_to_external_tool: /\b(?:upload|send|forward)\b/i,
      send_email: /\b(?:email|send|forward|resend)\b/i,
      accept_terms: /\b(?:accept|waive|settle)\b/i,
      quote_price: /\b(?:quote|offer|discount)\b/i,
    }[tool];
    const targets = [args.file, args.invoice, args.target, args.supplier, ...recipients].filter(Boolean);
    for (const source of inbound) {
      const directed = verbs?.test(source.body) && targets.some(target => source.body.includes(target));
      const authorized = verbs?.test(task.instruction ?? '') && targets.some(target => String(task.instruction ?? '').includes(target));
      if (directed && !authorized) add('R21', [cite(source, 'instruction came only from untrusted inbound text', tool)]);
    }
    if (inbound.some(f => /(?:skip|without waiting for|bypass).*approval/i.test(f.body)) && args.skip_approval === true) {
      add('R21', inbound.map(f => cite(f, 'untrusted instruction to bypass approval')));
    }
  }

  let decision = strictest(matches.map(m => m.decision));
  const unsupportedTool = !['send_email', 'quote_price', 'accept_terms', 'pay_supplier', 'order_from_supplier', 'upload_to_external_tool', 'delete_file'].includes(tool);
  const missingFiles = [args.file, args.invoice, ...(args.files ?? []), ...(args.attachments ?? [])].filter(path => path && !context.files[path]);
  if (unsupportedTool || missingFiles.length) {
    decision = 'BLOCK';
    evidence.push({ source: null, claim: 'invalid action', value: missingFiles.join(', ') || tool, text: 'Unsupported tool or missing file. Nothing can execute.' });
  } else if (!matches.some(m => !['R18', 'R22'].includes(m.id)) && !(order && obligations.length === 0 && evidence.some(e => e.claim === 'owner confirmed spend'))) {
    decision = strictest([decision, 'HOLD_FOR_APPROVAL']);
    evidence.push({ source: 'policy.json', claim: 'no permission', value: tool, text: 'No policy rule grants this action. Owner review required.' });
  }
  return { decision, rules: matches.map(m => m.id), matches, evidence, obligations, figures };
}
