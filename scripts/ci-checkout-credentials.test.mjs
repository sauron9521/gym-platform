import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const targetWorkflows = [
  ['ci.yml', 20],
  ['web-integration.yml', 2],
  ['dependency-audit.yml', 1],
  ['mobile-native-e2e.yml', 1],
  ['ovranto-visual-review.yml', 1],
  ['staging-live-smoke.yml', 1],
];

function checkoutSteps(workflow) {
  const lines = workflow.split('\n');
  const steps = [];

  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(\s*)(-\s*)?uses:\s*actions\/checkout@\S+/);
    if (!match) continue;

    const useIndent = match[1].length;
    const stepIndent = match[2] ? useIndent : useIndent - 2;
    const optionIndent = useIndent + (match[2] ? 4 : 2);
    let persistsCredentials = false;

    for (let next = index + 1; next < lines.length; next++) {
      const line = lines[next];
      if (!line.trim() || line.trimStart().startsWith('#')) continue;

      const indent = line.match(/^\s*/)[0].length;
      if (indent <= stepIndent) break;
      if (indent === optionIndent && line.trim() === 'persist-credentials: false') {
        persistsCredentials = true;
      }
    }

    steps.push({ line: index + 1, persistsCredentials });
  }

  return steps;
}

test('read-only CI and manual workflow checkouts never persist Git credentials', () => {
  for (const [name, expectedCount] of targetWorkflows) {
    const workflow = readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');

    const steps = checkoutSteps(workflow);
    assert.equal(steps.length, expectedCount, name + ': checkout inventory changed');
    for (const { line, persistsCredentials } of steps) {
      assert.ok(persistsCredentials, name + ':' + line + ' must set persist-credentials: false');
    }
  }
});
