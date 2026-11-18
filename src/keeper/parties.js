export const normalize = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const emails = text => [...String(text ?? '').matchAll(/[\w.+-]+@[\w.-]+/g)].map(m => m[0].toLowerCase().replace(/[.-]+$/, ''));

function csvRow(line) {
  return [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map(m => m[1].replace(/^"|"$/g, '').replaceAll('""', '"'));
}
export function loadParties(files) {
  const parties = [];
  for (const file of Object.values(files)) {
    const lines = file.body.trim().split(/\r?\n/);
    if (/^client,contact,email,/.test(lines[0])) {
      const keys = csvRow(lines.shift());
      for (const line of lines) {
        const row = Object.fromEntries(csvRow(line).map((value, i) => [keys[i], value]));
        parties.push({ name: row.client, contact: row.contact, email: row.email.toLowerCase(), type: 'client', source: file.path });
      }
    }
    if (/supplier list/i.test(file.header.title ?? '')) {
      for (const line of lines) {
        const cells = line.split('|').map(s => s.trim());
        const address = emails(cells[3])[0];
        if (address) parties.push({ name: cells[1], email: address, type: 'supplier', source: file.path });
      }
    }
  }
  return parties;
}
export function relatedParties(file, parties) {
  const primary = [file.header.client, file.header.title, file.path, file.header.from].filter(Boolean).join(' ');
  const match = text => parties.filter(p => {
    const brand = p.name.split(/\s/)[0];
    return normalize(text).includes(normalize(brand)) || text.toLowerCase().includes(p.email) ||
      (p.contact && text.toLowerCase().includes(p.contact.toLowerCase()));
  });
  const direct = match(primary);
  return direct.length ? direct : match(file.body);
}
export function resolveParty(value, parties) {
  const target = normalize(value);
  if (!target) return undefined;
  return parties.find(p => p.email.toLowerCase() === String(value).toLowerCase() || normalize(p.name) === target ||
    normalize(p.name).startsWith(target) || target === normalize(p.name.split(' ')[0]));
}
export function editDistance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j])));
    row = next;
  }
  return row[b.length];
}
export function lookalike(address, parties) {
  const domain = address.split('@')[1]?.toLowerCase();
  if (!domain) return undefined;
  return parties.filter(p => p.type === 'client').find(p => {
    const known = p.email.split('@')[1];
    if (known === domain) return false;
    const host = domain.split('.')[0];
    const brand = normalize(p.name.split(' ')[0]);
    return editDistance(normalize(host), normalize(known.split('.')[0])) <= 2 ||
      (brand.length >= 4 && normalize(host).includes(brand));
  });
}
