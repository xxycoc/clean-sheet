export function makeBriefing(rows, date = rows.at(-1)?.time?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Error('date must be YYYY-MM-DD (UTC)');
  const day = rows.filter(e => e.time?.slice(0, 10) === date);
  const decisions = day.filter(e => e.type === 'keeper.decision' && !e.revalidation);
  const pending = new Map();
  for (const e of rows.filter(e => e.time?.slice(0, 10) <= date)) {
    if (e.type === 'approval.queued') pending.set(e.id, e.entry);
    if (e.type === 'owner.decision') pending.delete(e.id);
  }
  const reads = day.filter(e => e.type === 'file.read' && e.in_scope === false);
  const allowedReads = reads.filter(e => e.decision === 'ALLOW');
  const spend = [...pending.values()].filter(e => e.decision.rules.includes('R12') || e.action.tool === 'pay_supplier').reduce((sum, e) => {
    const inferred = e.decision.evidence.map(v => v.text ?? '').join('\n').match(/Same price, SGD\s*([\d,]+)/i);
    return sum + (e.action.args.amount ?? (inferred ? Number(inferred[1].replaceAll(',', '')) : 0));
  }, 0);
  const receivables = Math.max(0, ...[...pending.values()].filter(e => e.decision.rules.includes('R16')).flatMap(e => e.decision.evidence.flatMap(v => [...(v.text ?? '').matchAll(/Outstanding receivables:\s*SGD\s*([\d,]+)/gi)].map(m => Number(m[1].replaceAll(',', ''))))));
  const counts = { blocked: decisions.filter(e => e.decision === 'BLOCK').length, held: decisions.filter(e => e.decision === 'HOLD_FOR_APPROVAL').length,
    allowed: decisions.filter(e => e.decision === 'ALLOW').length, pending: pending.size, spend_at_stake_sgd: spend, receivables_at_stake_sgd: receivables,
    unnecessary_reads: allowedReads.length, refused_reads: reads.filter(e => e.decision !== 'ALLOW').length,
    unnecessary_files: [...new Set(allowedReads.map(e => e.file))], refused_files: [...new Set(reads.filter(e => e.decision !== 'ALLOW').map(e => e.file))],
    executed: day.filter(e => e.type === 'action.executed').length, notifications_queued: day.filter(e => e.type === 'notification.queued').length };
  const rules = new Set(decisions.filter(e => e.decision === 'BLOCK').flatMap(e => e.rules));
  const reasons = [rules.has('R15') && 'private data uploads', rules.has('R08') && 'offers below your floor', rules.has('R18') && 'unsupported figures', rules.has('R21') && 'suspicious instructions', rules.has('R20') && 'another client’s private work'].filter(Boolean);
  const cashflow = reads.find(e => /cashflow/i.test(e.file));
  const bank = reads.some(e => /bank_details/.test(e.file) && e.decision !== 'ALLOW');
  const owner = reads.some(e => /owner_records/.test(e.file) && e.decision !== 'ALLOW');
  const parts = [
    `Here is your Clean Sheet update for ${date}.`,
    `The Keeper blocked ${counts.blocked} proposed actions${reasons.length ? ` involving ${reasons.join(', ')}` : 'under your policy'}.`,
    `${counts.pending} requests wait for your approval. Proposed spend totals SGD ${spend.toLocaleString('en-SG')}; deletion requests involve records showing SGD ${receivables.toLocaleString('en-SG')} in outstanding receivables. These are separate amounts, not a combined loss.`,
    cashflow ? (cashflow.decision === 'ALLOW' ? 'Support read cashflow notes it did not need for the QuickPrint reply.' : 'Support requested cashflow notes it did not need for QuickPrint; that read was refused.') : `${counts.unnecessary_reads} permitted reads fell outside the declared task scope.`,
    bank || owner ? `Requests for ${[bank && 'bank details', owner && 'owner records'].filter(Boolean).join(' and ')} were refused; no contents were returned.` : `${counts.refused_reads} out of scope reads were refused without returning file contents.`,
    allowedReads.some(e => /proposal_ferro/.test(e.file)) ? 'Sales also read Ferro’s proposal outside its task.' : '',
    'For blocked and pending actions, nothing was sent or changed by those actions.',
    `${counts.executed} allowed or released actions completed locally. This is a demonstration: nothing was sent outside the workspace, and no real payment was made.`,
  ];
  const fillers = ['Check the waiting requests before you approve any spending or deletion.', 'The queue keeps the reasons and source records beside each proposed action.', 'You can release a request or reject it after checking the details.', 'Routine work can continue while you review the items that need your judgment.'];
  let script = parts.join(' ');
  for (const sentence of fillers) { if (wordCount(script) >= 140) break; if (wordCount(`${script} ${sentence}`) <= 160) script += ` ${sentence}`; }
  return { date, script, word_count: wordCount(script), counts, video_url: null };
}
export function wordCount(text) { return text.trim().split(/\s+/).length; }
