import { pathToFileURL } from 'node:url';
import { loadFixtures, loadTestJSON } from '../src/fixtures.js';
import { createKeeper } from '../src/keeper/engine.js';
import { labelFile } from '../src/keeper/labels.js';

export function score() {
  const fixtures = loadFixtures();
  const keeper = createKeeper(fixtures);
  const harness = loadTestJSON('harness.json');
  const evidenceKeys = loadTestJSON('evidence_expectations.json');
  const rows = [...fixtures.scenarios, ...fixtures.extraScenarios].map(scenario => {
    const task = harness.find(t => t.id === scenario.id);
    const result = keeper.runTask(task, task.steps);
    const expected = scenario.expected_oversight;
    const text = JSON.stringify(result.evidence).toLowerCase();
    const missingEvidence = evidenceKeys[scenario.id].filter(value => !text.includes(value.toLowerCase()));
    const missingRules = expected.rules.filter(rule => !result.rules.includes(rule));
    const checks = [result.decision === expected.decision, missingRules.length === 0, missingEvidence.length === 0];
    return { id: scenario.id, decision: result.decision, points: checks.filter(Boolean).length, checks, missingRules, missingEvidence,
      extraRules: result.rules.filter(rule => !expected.rules.includes(rule)), result };
  });
  const normals = loadTestJSON('normal_actions.json').map(task => ({ id: task.id, expected: task.expected,
    result: keeper.runTask(task, task.steps) }));
  const labelChecks = fixtures.groundTruth.map(entry => ({ ...entry, actual: labelFile(fixtures.files[entry.file], keeper.context).level }));
  // The supplied key has 27 rows; the unlabelled dataset README is the 28th kit file.
  const readme = Object.values(fixtures.files).find(f => /^\d+_README\.md$/.test(f.path));
  const readmeLabel = labelFile(readme, keeper.context).level;
  const keyCorrect = labelChecks.filter(e => e.actual === e.sensitivity).length;
  const kit = rows.slice(0, fixtures.scenarios.length).reduce((n, r) => n + r.points, 0);
  const extra = rows.slice(fixtures.scenarios.length).reduce((n, r) => n + r.points, 0);
  const normalCorrect = normals.filter(n => n.expected === n.result.decision).length;
  const lines = ['Scenario | Decision          | Decision / Rules / Evidence | Score',
    ...rows.map(r => `${r.id.padEnd(8)} | ${r.decision.padEnd(17)} | ${r.checks.map(c => c ? 'PASS' : 'FAIL').join(' / ')} | ${r.points}/3`),
    `Kit S1-S5: ${kit}/15`, `Extra S6-S7: ${extra}/6`,
    `Normal actions: ${normalCorrect}/${normals.length} correct; ${normals.filter(n => n.expected === 'ALLOW' && n.result.decision !== 'ALLOW').length} false alarms`,
    `Ground-truth labels: ${keyCorrect}/${labelChecks.length} (the supplied key contains 27 entries)`,
    `All 28 kit files: ${keyCorrect + Number(readmeLabel === 'regulated')}/28 including separately asserted README label (${readmeLabel})`,
    ...rows.filter(r => r.extraRules.length).map(r => `Warning ${r.id}: additional rules ${r.extraRules.join(', ')}`),
    ...rows.filter(r => r.missingRules.length || r.missingEvidence.length).map(r => `Missing ${r.id}: rules [${r.missingRules}]; evidence [${r.missingEvidence}]`),
    ...normals.filter(n => n.expected !== n.result.decision).map(n => `Normal failure ${n.id}: expected ${n.expected}, got ${n.result.decision}`)];
  return { rows, normals, labelChecks, kit, extra, normalCorrect, output: lines.join('\n'),
    passed: kit === 15 && extra === 6 && normalCorrect === normals.length && keyCorrect === labelChecks.length && readmeLabel === 'regulated' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = score();
  console.log(result.output);
  if (!result.passed) process.exitCode = 1;
}
