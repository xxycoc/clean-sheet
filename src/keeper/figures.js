import { relatedParties, resolveParty } from './parties.js';
import { inScope } from './scope.js';

const words = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14, thirty: 30 };
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const number = value => words[value.toLowerCase()] ?? Number(value.replaceAll(',', ''));
const numberPattern = `(?:\\d+(?:,\\d{3})*(?:\\.\\d+)?|${Object.keys(words).join('|')})`;

export function extractFigures(text) {
  const figures = [];
  // Clock times are scheduling details, not the bare prices accepted after "at".
  const occupied = [...text.matchAll(/\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*[ap]m\b)?|\b(?:0?[1-9]|1[0-2])\s*[ap]m\b/gi)]
    .map(m => [m.index, m.index + m[0].length]);
  function scan(regex, kind, value) {
    for (const match of text.matchAll(regex)) {
      const start = match.index, end = start + match[0].length;
      if (occupied.some(([a, b]) => start < b && end > a)) continue;
      occupied.push([start, end]);
      figures.push({ kind, raw: match[0], value: value(match), index: start,
        context: text.slice(Math.max(0, start - 65), Math.min(text.length, end + 65)) });
    }
  }
  scan(/\b(\d{4})-(\d{2})-(\d{2})\b/g, 'date', m => ({ year: +m[1], month: +m[2], day: +m[3] }));
  scan(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, 'date', m => ({ day: +m[1], month: +m[2], year: +m[3] }));
  scan(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(\d{4}))?\b/gi,
    'date', m => ({ day: +m[1], month: months.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, year: m[3] ? +m[3] : null }));
  scan(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/gi,
    'date', m => ({ month: months.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, year: +m[2], day: null }));
  scan(/\b\d+(?:\.\d+)?\s*(?:%|percent\b)/gi, 'percentage', m => parseFloat(m[0]));
  scan(new RegExp(`\\b(${numberPattern})[ -]+(minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\\b`, 'gi'), 'duration', m => {
    const unit = m[2].toLowerCase().replace(/s$/, '').replace(/^mins?$/, 'minute').replace(/^hrs?$/, 'hour');
    const factor = { minute: 1, hour: 60, day: 1440, week: 10080 }[unit];
    return { amount: number(m[1]) * (factor ?? 1), unit: factor ? 'minute' : unit };
  });
  scan(/(?:SGD\s*|S\$\s*|\$\s*)(\d+(?:,\d{3})*(?:\.\d+)?)\s*([MK])?\b/gi, 'amount', m => number(m[1]) * ({ m: 1e6, k: 1e3 }[m[2]?.toLowerCase()] ?? 1));
  scan(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, 'amount', m => number(m[0]));
  // Table cells carry their currency in the heading, not on every row.
  if (/\bSGD\b/.test(text)) scan(/(?<=\|[ \t*]*)(\d+(?:\.\d+)?)(?=[ \t*]*\|)/g, 'amount', m => number(m[1]));
  scan(/\b(?:total|fee|price|surcharge|pay|payment|match|at|balance|worth|amount)\s*(?:(?:is|of|stands at|:|=)\s*)?(\d+(?:\.\d+)?)\b/gi,
    'amount', m => number(m[1]));
  scan(/\b(?:19|20)\d{2}\b/g, 'date', m => ({ year: +m[0], month: null, day: null }));
  // Remove invoice/reference identifiers, which are identifiers rather than dates.
  return figures.filter(f => !(f.kind === 'date' && f.value.month === null && /[-/]\d/.test(text.slice(f.index + f.raw.length, f.index + f.raw.length + 3)))).sort((a, b) => a.index - b.index);
}
export function sameFigure(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'date') return ['year', 'month', 'day'].every(k => a.value[k] == null || b.value[k] == null || a.value[k] === b.value[k]) &&
    ['month', 'day'].every(k => a.value[k] == null || b.value[k] != null);
  if (a.kind === 'duration') return a.value.unit === b.value.unit && a.value.amount === b.value.amount;
  return a.value === b.value;
}
function distance(a, b) {
  if (a.kind === 'date') return Math.abs((a.value.month ?? 0) - (b.value.month ?? 0)) * 31 + Math.abs((a.value.day ?? 0) - (b.value.day ?? 0));
  return Math.abs((a.value.amount ?? a.value) - (b.value.amount ?? b.value));
}
export function checkFigures(text, task, context, recipient) {
  const party = resolveParty(recipient ?? task.client, context.parties);
  const sources = Object.values(context.files).filter(file => {
    if (file.header.trust === 'untrusted') return false;
    if (file.header.from && !context.parties.some(p => p.email === file.header.from) &&
      !context.ownerEmails?.includes(file.header.from)) return false;
    const owners = relatedParties(file, context.parties).filter(p => p.type === 'client');
    const isPublic = file.header.sensitivity === 'public';
    if (party?.type === 'client' && owners.length && !owners.some(p => p.name === party.name) && !isPublic) return false;
    return (party && owners.some(p => p.name === party.name)) || inScope(task, file, context.parties);
  });
  const candidates = sources.flatMap(file => extractFigures(`${file.header.date ? `Date: ${file.header.date}\n` : ''}${file.body}`).map(figure => ({ ...figure, source: file.path, text: file.body })));
  const checks = extractFigures(text).map(claim => {
    const sameKind = candidates.filter(c => c.kind === claim.kind);
    const matched = sameKind.find(c => sameFigure(claim, c));
    const closest = matched ?? sameKind.sort((a, b) => distance(claim, a) - distance(claim, b) ||
      Number((task.reads ?? []).includes(b.source)) - Number((task.reads ?? []).includes(a.source)))[0];
    return { claim: claim.raw, kind: claim.kind, supported: Boolean(matched), source: closest?.source ?? null,
      value: closest?.raw ?? null, text: closest?.text ?? 'No matching source in this client or task.' };
  });
  return { checks, unsupported: checks.filter(c => !c.supported) };
}
