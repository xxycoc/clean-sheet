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
  const receivables = [...pending.values()].filter(e => e.decision.rules.includes('R16')).reduce((sum, e) => {
    const amounts = new Set(e.decision.evidence.flatMap(v => [...(v.text ?? '').matchAll(/Outstanding receivables:\s*SGD\s*([\d,]+(?:\.\d+)?)/gi)].map(m => Number(m[1].replaceAll(',', '')))));
    return sum + [...amounts].reduce((total, amount) => total + amount, 0);
  }, 0);
  const counts = { blocked: decisions.filter(e => e.decision === 'BLOCK').length, held: decisions.filter(e => e.decision === 'HOLD_FOR_APPROVAL').length,
    allowed: decisions.filter(e => e.decision === 'ALLOW').length, pending: pending.size, spend_at_stake_sgd: spend, receivables_at_stake_sgd: receivables,
    unnecessary_reads: allowedReads.length, refused_reads: reads.filter(e => e.decision !== 'ALLOW').length,
    unnecessary_files: [...new Set(allowedReads.map(e => e.file))], refused_files: [...new Set(reads.filter(e => e.decision !== 'ALLOW').map(e => e.file))],
    executed: day.filter(e => e.type === 'action.executed').length, notifications_queued: day.filter(e => e.type === 'notification.queued').length };
  const read_details = reads.map(e => ({ agent: e.agent, action: 'read_file', file: e.file, level: e.level, decision: e.decision, rules: e.rules }));
  const action_details = decisions.map(e => ({ agent: e.agent, action: day.find(p => p.type === 'action.proposed' && p.id === e.id)?.tool,
    level: e.data_level, decision: e.decision, rules: e.rules, owner_message: e.owner_message }));
  const parts = [
    `Here is your Clean Sheet update for ${date}.`,
    `The Keeper blocked ${counts.blocked} proposed actions and held ${counts.held} for review; ${counts.allowed} received an allow decision.`,
    `${counts.pending} requests remain pending. Proposed spend totals SGD ${spend.toLocaleString('en-SG')}; deletion requests involve SGD ${receivables.toLocaleString('en-SG')} in outstanding receivables. These amounts describe different exposures, not a combined loss.`,
    `Outside declared scope, ${counts.unnecessary_reads} reads were allowed and ${counts.refused_reads} were refused without returning contents.`,
    `${counts.executed} allowed or released actions completed locally. This demonstration sends nothing outside the workspace and makes no real payments.`,
    'Review the pending queue before approving spending or deletion. Each request records the proposed action, policy decision and supporting evidence.',
  ];
  let script = parts.join(' ');
  for (const e of read_details) {
    const detail = `${e.agent}: ${e.action} ${e.file}, ${e.level}, ${e.decision} (${e.rules.join(', ')}).`;
    if (wordCount(`${script} ${detail}`) <= 160) script += ` ${detail}`;
  }
  const fillers = ['The read details identify the agent, file label, decision and rules recorded in the log.',
    'Check the source records and owner messages before deciding whether a request should proceed.',
    'You can release a waiting request or reject it after reviewing its details.',
    'Routine work can continue during review.', 'Review each request carefully.'];
  for (const sentence of fillers) {
    if (wordCount(script) >= 140) break;
    if (wordCount(`${script} ${sentence}`) <= 160) script += ` ${sentence}`;
  }
  return { date, script, word_count: wordCount(script), counts, read_details, action_details, video_url: null };
}
export function wordCount(text) { return text.trim().split(/\s+/).length; }
