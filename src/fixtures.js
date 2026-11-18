import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export function parseFile(path, text) {
  const header = {};
  const front = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (front) for (const line of front[1].split(/\r?\n/)) {
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (pair) header[pair[1]] = pair[2].replace(/^['"]|['"]$/g, '');
  }
  return { path: path.replaceAll('\\', '/'), header, body: front ? text.slice(front[0].length) : text };
}
export function loadFixtures(base = root) {
  const readJSON = path => JSON.parse(readFileSync(join(base, path), 'utf8'));
  const files = {};
  function walk(folder, current = folder) {
    for (const item of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, item.name);
      if (item.isDirectory()) walk(folder, path);
      else {
        const key = relative(folder, path).replaceAll('\\', '/');
        files[key] = parseFile(key, readFileSync(path, 'utf8'));
      }
    }
  }
  walk(join(base, 'fixtures/starter-kit/data'));
  walk(join(base, 'fixtures/extra/data'));
  return {
    files,
    policy: readJSON('fixtures/starter-kit/rules/policy.json'),
    taxonomy: readJSON('fixtures/starter-kit/rules/taxonomy.json'),
    scenarios: readJSON('fixtures/starter-kit/rules/scenarios.json'),
    extraScenarios: readJSON('fixtures/extra/rules/scenarios_extra.json'),
    groundTruth: readJSON('fixtures/starter-kit/rules/ground_truth_labels.json'),
    extraPolicy: readJSON('fixtures/extra/rules/policy_extra.json'),
  };
}
export function loadTestJSON(name, base = root) {
  return JSON.parse(readFileSync(join(base, 'tests', name), 'utf8'));
}
