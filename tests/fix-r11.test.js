import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixtures, loadTestJSON } from '../src/fixtures.js';
import { createKeeper } from '../src/keeper/engine.js';

const keeper = createKeeper(loadFixtures());
const task = { id: 'r11', agent: 'Finance', instruction: 'Review supplier payments.', scope: { files: [] } };
const base = { amount: 2300, supplier: 'Harbour Print', invoice: 'INV-0412' };
const pay = args => ({ tool: 'pay_supplier', args });
const cases = [
  ['unmatched over threshold', pay(base), 'HOLD_FOR_APPROVAL', 'R11'],
  ['unmatched below threshold', pay({ ...base, amount: 300 }), 'HOLD_FOR_APPROVAL', 'R11'],
  ['received invoice path', pay({ amount: 720, supplier: 'QuickPrint SG', invoice: 'finance/invoice_2026-037_quickprint.md' }), 'ALLOW', 'R10'],
  ['received invoice reference', pay({ amount: 720, supplier: 'QuickPrint SG', invoice: 'QP-88812' }), 'ALLOW', 'R10'],
  ['unknown supplier with existing invoice', pay({ amount: 720, supplier: 'Unlisted Printer', invoice: 'QP-88812' }), 'HOLD_FOR_APPROVAL', 'R11'],
  ['missing amount', pay({ supplier: base.supplier, invoice: base.invoice }), 'BLOCK'],
  ['negative amount', pay({ ...base, amount: -1 }), 'BLOCK'],
  ['string amount', pay({ ...base, amount: '300' }), 'BLOCK'],
  ['missing supplier', pay({ amount: 300, invoice: base.invoice }), 'BLOCK'],
  ['blank supplier', pay({ ...base, supplier: '  ' }), 'BLOCK'],
  ['unsupported tool', { tool: 'transfer_money', args: base }, 'BLOCK'],
  ['missing attachment', { tool: 'send_email', args: { to: 'outside@example.test', attachments: ['missing.md'] } }, 'BLOCK'],
  ['no permission', { tool: 'quote_price', args: {} }, 'HOLD_FOR_APPROVAL'],
];

for (const [name, action, expected, rule] of cases) {
  test(`R11: ${name}`, () => {
    const result = keeper.decideAction(task, action);
    assert.equal(result.decision, expected);
    if (rule) assert.ok(result.rules.includes(rule));
    if (expected === 'BLOCK') assert.ok(result.evidence.some(e => e.claim === 'invalid action'));
  });
}

test('R11 explains unmatched invoice, unknown supplier and amount without special-casing names', () => {
  const result = keeper.decideAction(task, pay(base));
  assert.equal(result.owner_message, 'Finance agent wants to pay Harbour Print SGD 2,300 for invoice INV-0412. Held for your approval: no matching invoice was found and it is over SGD 1,000.');
  assert.ok(result.evidence.some(e => e.claim === 'unknown supplier'));
  assert.ok(result.evidence.some(e => e.text === 'no matching invoice was found'));
  assert.ok(result.evidence.some(e => e.text === 'it is over SGD 1,000'));
  const small = keeper.decideAction(task, pay({ ...base, supplier: 'Another Printer', amount: 300 }));
  assert.match(small.owner_message, /no matching invoice was found/);
  assert.doesNotMatch(small.owner_message, /over SGD/);
  assert.match(keeper.decideAction(task, pay({ supplier: base.supplier })).owner_message, /amount must be a non-negative number/);
});

test('all kit, extra, normal and new decision paths have a reason sentence and no double spaces', () => {
  const results = [...loadTestJSON('harness.json'), ...loadTestJSON('normal_actions.json')]
    .flatMap(t => keeper.runTask(t, t.steps).events.filter(e => e.type === 'keeper.decision'));
  results.push(...cases.map(([, action]) => keeper.decideAction(task, action)));
  assert.deepEqual(new Set(results.map(r => r.decision)), new Set(['BLOCK', 'HOLD_FOR_APPROVAL', 'ALLOW']));
  for (const result of results) {
    const message = result.owner_message;
    assert.doesNotMatch(message, / {2}|undefined/, message);
    const reason = message.split(/(?:Blocked\.|Allowed\.|Held for your approval[.:])\s*/)[1];
    assert.ok(reason, message);
    const sentence = reason.split(/\.\s|\.$/)[0];
    assert.ok(sentence.trim().split(/\s+/).length >= 4, message);
    assert.notEqual(sentence, 'Nothing was sent or changed', message);
    assert.doesNotMatch(sentence, /^(The agent also requested|Blocked reads)/, message);
  }
});
