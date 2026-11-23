import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const pinnedActions = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node', '949feb2413d6458794dcd2491c4babbbce0c15c1'],
  ['pnpm/action-setup', '73e46992e05b19abd31f2f3c20e0e7370d762115'],
  ['actions/cache', '55cc8345863c7cc4c66a329aec7e433d2d1c52a9'],
  ['actions/upload-artifact', 'cf430e030ddbb5b0abf93d22962f4752f3646cd9'],
]);

const workflowInventory = [
  ['dependency-audit.yml', 3],
  ['staging-live-smoke.yml', 2],
  ['roadmap-milestones.yml', 2],
  ['ovranto-visual-review.yml', 5],
];

test('pilot workflows pin every external action to a reviewed immutable commit', () => {
  for (const [filename, expectedCount] of workflowInventory) {
    const workflow = readFileSync(
      new URL('../.github/workflows/' + filename, import.meta.url),
      'utf8',
    );
    const references = [...workflow.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)];
    assert.equal(references.length, expectedCount, filename + ': action inventory changed');

    for (const match of references) {
      const [action, revision] = match[1].split('@');
      assert.match(revision ?? '', /^[0-9a-f]{40}$/, filename + ': unpinned action ' + action);
      assert.equal(revision, pinnedActions.get(action), filename + ': unreviewed action ' + action);
    }
  }
});
