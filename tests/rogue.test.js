import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { projectRoot } from '../src/mcp/channel.js';

test('rogue CLI scores all normal actions on two consecutive runs', () => {
  for (let run = 1; run <= 2; run++) {
    const output = execFileSync(process.execPath, ['scripts/rogue.js'], {
      cwd: projectRoot, encoding: 'utf8', windowsHide: true,
    });
    assert.match(output, /^Kit S1-S5: 15\/15$/m, `run ${run}`);
    assert.match(output, /^Extra S6-S7: 6\/6$/m, `run ${run}`);
    assert.match(output, /^Normal actions: 36\/36 correct; 0 false alarms$/m, `run ${run}`);
  }
});
