import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/static-ci-analysis.yml', import.meta.url),
  'utf8',
);

test('the static CI pilot scans relevant workflow and shell changes', () => {
  assert.match(workflow, /^  pull_request:$/m);
  assert.match(workflow, /^  push:$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  for (const path of ["'.github/**'", "'scripts/**/*.sh'", "'infra/**/*.sh'"]) {
    assert.ok(workflow.includes(path), 'Missing static scan path: ' + path);
  }
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
});

test('pinned scanners cover workflow YAML, embedded shell and standalone .sh files', () => {
  assert.match(workflow, /rhysd\/actionlint:1\.7\.12 -shellcheck=shellcheck/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /\/repo:ro/);
  assert.match(
    workflow,
    /git ls-files -z -- '\*\.sh' \| xargs -0 -r shellcheck --severity=warning --/,
  );
  assert.match(workflow, /astral-sh\/setup-uv@[0-9a-f]{40}/);
  assert.match(workflow, /enable-cache: false/);
  assert.match(workflow, /zizmor@1\.32\.0/);
  assert.match(workflow, /--offline --collect=workflows --strict-collection --format=github/);
});

test('scanner findings are reported but cannot change required PR gates in the pilot', () => {
  assert.match(workflow, /advisory/);
  for (const id of ['actionlint', 'shellcheck', 'zizmor']) {
    assert.match(workflow, new RegExp('id: ' + id + '\\n\\s+continue-on-error: true'));
    assert.ok(workflow.includes('steps.' + id + '.outcome'), 'Missing summary for ' + id);
  }
  assert.match(workflow, /if: always\(\)/);
  assert.ok(!workflow.includes('security-events: write'));
});
