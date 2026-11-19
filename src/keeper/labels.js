import { emails, relatedParties } from './parties.js';

export const levels = ['public', 'internal', 'client-confidential', 'regulated'];
export function highest(values, taxonomy) {
  const ranks = Object.fromEntries((taxonomy?.levels ?? levels.map((id, rank) => ({ id, rank }))).map(l => [l.id, l.rank]));
  return values.filter(v => v in ranks).sort((a, b) => ranks[b] - ranks[a])[0] ?? 'public';
}
export function detectContent(text, taxonomy, parties = [], declared) {
  const hits = [];
  const add = (level, reason) => { if (!taxonomy || taxonomy.detection_hints[level]) hits.push({ level, reason }); };
  const identifiers = [...text.matchAll(/\b[a-z]\d{7}[a-z]\b/gi)];
  if (identifiers.some(match => declared === 'regulated' ||
    /\b(?:NRIC|IC|FIN|passport|ID\s+number)\b/i.test(text.slice(Math.max(0, match.index - 80), match.index + match[0].length + 80)))) add('regulated', 'NRIC pattern');
  if (/\b\d{3}-\d{6}-\d\b|\b(?:\d[ -]?){13,19}\b|\b(?:bank account|paynow|card number)\s*[:=]/i.test(text)) add('regulated', 'bank or card identifier');
  if (/\b(?:patient_name|reason_for_visit|diagnosis\s*:|home address\s*:)|\b(?:patient|medical)\s+(?:data|record|details)\b/i.test(text)) add('regulated', 'health or home details');
  if (/(?:[A-Z][a-z]+[ \t]+){1,3}[A-Z][a-z]+[^\n]{0,60}(?:\+65\s*)?\d{4}[ -]\d{4}/.test(text) || /^client,contact,email,phone/m.test(text)) add('regulated', 'named contact and phone');
  if (/\b(?:contract|agreement|proposal|confidential|unannounced|not public|keep quiet|NDA)\b/i.test(text)) add('client-confidential', 'confidentiality or contract language');
  if (parties.some(p => p.type === 'client' && text.toLowerCase().includes(p.name.split(' ')[0].toLowerCase())) && /\d/.test(text)) add('client-confidential', 'client and figure');
  if (/\b(?:invoice|supplier|plan|to-do|reminder)\b/i.test(text)) add('internal', 'business working information');
  return { level: highest(hits.map(h => h.level), taxonomy), hints: hits };
}
export function labelFile(file, context = {}) {
  const { files = {}, taxonomy, parties = [] } = context;
  const companion = files[file.path.replace(/\.[^.]+$/, '.README.md')];
  const declared = file.header.sensitivity ?? companion?.header.sensitivity;
  const detected = detectContent(file.body, taxonomy, parties, declared);
  // The kit treats a business invoice's payment-routing line as internal.
  // Other concrete personal identifiers still override an unsafe low header.
  const invoiceRouting = declared === 'internal' && /invoice/i.test(file.header.title ?? '') && /Pay to:/i.test(file.body) &&
    detected.hints.filter(h => h.level === 'regulated').every(h => h.reason === 'bank or card identifier');
  const level = detected.level === 'regulated' && !invoiceRouting ? 'regulated' :
    (levels.includes(declared) ? declared : detected.level);
  return { level, clients: relatedParties(file, parties).filter(p => p.type === 'client').map(p => p.name),
    hints: detected.hints, declared: declared ?? null, detected_level: detected.level,
    evidence: [{ source: file.path, claim: 'data label', value: level, text: file.header.title ?? file.body.slice(0, 160) },
      ...(companion && !file.header.sensitivity ? [{ source: companion.path, claim: 'companion label', value: level, text: companion.body }] : [])] };
}
// Match material, not the mere mention of a client or a recipient address.
function words(text) { return text.toLowerCase().match(/[a-z0-9]+/g) ?? []; }
function carries(text, source, recipients) {
  const stripRecipients = value => value.replace(/[\w.+-]+@[\w.-]+/g, address =>
    recipients.includes(address.toLowerCase().replace(/[.-]+$/, '')) ? ' ' : address);
  const outgoing = stripRecipients(text).toLowerCase();
  const content = stripRecipients(source).toLowerCase();
  if (emails(content).some(address => emails(outgoing).includes(address))) return true;
  // Numeric tokens include figures, phone numbers and mixed letter/digit identifiers.
  // Single digits alone are too common to establish provenance.
  const tokens = value => value.match(/\b(?:[a-z]*\d[\da-z]*(?:[,. -]\d+)*[a-z]*)\b/g) ?? [];
  const normalizeToken = value => value.replace(/[ ,.-]/g, '');
  const sent = new Set(tokens(outgoing).map(normalizeToken));
  if (tokens(content).some(token => normalizeToken(token).length >= 2 && sent.has(normalizeToken(token)))) return true;
  const sourceWords = words(content), sentWords = ` ${words(outgoing).join(' ')} `;
  return sourceWords.some((_, i) => i + 5 <= sourceWords.length &&
    sentWords.includes(` ${sourceWords.slice(i, i + 5).join(' ')} `));
}

export function labelOutgoing(text, readFiles, attachments, context, recipients = []) {
  const own = detectContent(text, context.taxonomy, context.parties);
  const approved = Object.values(context.files).find(f => f.header.sensitivity === 'public' &&
    text.trim().length >= 20 && f.body.includes(text.trim()));
  if (approved && own.level !== 'regulated') own.level = 'public';
  const attached = new Set(attachments.map(f => f.path));
  const inherited = [...new Map([...readFiles, ...attachments]
    .filter(file => attached.has(file.path) || carries(text, file.body, recipients))
    .map(f => [f.path, f])).values()];
  const labels = inherited.map(file => {
    const label = labelFile(file, context);
    // A contact table contains multiple clients; attribute only the rows being sent.
    if (!attached.has(file.path) && /^client,contact,email,/m.test(file.body)) {
      label.clients = [...new Set(file.body.split(/\r?\n/).slice(1)
        .filter(row => carries(text, row, recipients))
        .flatMap(row => relatedParties({ path: '', header: {}, body: row }, context.parties))
        .filter(p => p.type === 'client').map(p => p.name))];
    }
    return { file, ...label };
  });
  return { level: highest([own.level, ...labels.map(l => l.level)], context.taxonomy),
    inherited_from: inherited.map(f => f.path), items: labels, own,
    evidence: [...labels.flatMap(l => l.evidence), ...(approved ? [{ source: approved.path, claim: 'published content', value: 'public', text }] : [])] };
}
