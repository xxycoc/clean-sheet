export function ownerMessage(task, action, result) {
  const who = `${task.agent ?? 'Worker'} agent`;
  const outcome = { BLOCK: 'Blocked.', HOLD_FOR_APPROVAL: 'Held for your approval.', ALLOW: 'Allowed.' }[result.decision];
  const details = [];
  if (result.rules.includes('R08')) {
    const floor = result.evidence.find(e => e.source === 'policy.json' && /offer/.test(e.claim));
    details.push(`${floor?.claim}; your floor is ${floor?.value}. Counter at the floor or above.`);
  }
  if (result.rules.includes('R21')) {
    const address = result.evidence.find(e => e.claim === 'untrusted recipient');
    const domain = result.evidence.find(e => /resembles/.test(e.text));
    details.push(`The recipient or instruction came from suspicious mail${address ? `: ${address.value}` : ''}.${domain ? ` ${domain.text}` : ''} Verify through the known contact.`);
  }
  if (result.rules.includes('R20')) details.push('This carries another client’s confidential work. Use a public, approved sample.');
  if (result.rules.includes('R19')) details.push('The client has not made this news public. Remove the private news.');
  if (result.figures?.unsupported.length) details.push(`These figures have no matching source: ${result.figures.unsupported.map(f => `${f.claim} (source: ${f.value ?? 'none'})`).join('; ')}. Correct the draft.`);
  if (result.rules.includes('R16')) {
    const outstanding = result.evidence.find(e => /outstanding receivables/i.test(e.text));
    const amount = outstanding?.text.match(/Outstanding receivables:\s*(SGD\s*[\d,]+)/i)?.[1];
    details.push(`${result.evidence.some(e => /\bUNPAID\b/i.test(e.text)) ? 'The records include unpaid invoices. ' : ''}${amount ? `${amount} is outstanding. ` : ''}Review before deleting.`);
  }
  if (result.rules.includes('R17')) details.push('Delete the data received in error, then notify the client and owner.');
  if (result.rules.includes('R12')) {
    const spend = result.evidence.find(e => /Same price, SGD/i.test(e.text))?.text.match(/SGD\s*[\d,]+/)?.[0] ??
      (action.args?.amount != null ? `SGD ${action.args.amount}` : 'New spend');
    details.push(`${spend} needs written confirmation. Confirm the order before releasing it.`);
  }
  if (result.rules.includes('R15')) details.push('This holds private client or personal data. Keep it out of external tools.');
  if (result.rules.includes('R09')) details.push('Changing the contract or settling for less is your call.');
  if (!details.length && result.decision === 'HOLD_FOR_APPROVAL') details.push('Review the recipient, data and terms before releasing it.');
  const blockedReads = result.scope_creep ?? [];
  if (blockedReads.length) details.push(`The agent also requested files outside its task: ${blockedReads.join(', ')}. Regulated reads were blocked.`);
  return `${who} proposed ${action.tool.replaceAll('_', ' ')}${action.args?.to ? ` to ${action.args.to}` : ''}. ${outcome} ${details.join(' ')}${result.decision !== 'ALLOW' ? ' Nothing was sent or changed.' : ''}`.trim();
}
