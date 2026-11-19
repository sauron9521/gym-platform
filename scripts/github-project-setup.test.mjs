import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  activeIssues,
  existingProject,
  missingIssues,
  statusOptions,
  STAGES,
} from './github-project-setup.mjs';

const issue = (number, phase, type = 'type:task', extra = {}) => ({
  number,
  state: 'open',
  labels: [type, 'phase:' + phase].map((name) => ({ name })),
  milestone: { title: phase + ' — Platform' },
  html_url: 'https://github.com/sauron9521/gym-platform/issues/' + number,
  ...extra,
});

describe('GitHub Projects setup safety', () => {
  it('loads only active, phase-assigned Issues, excluding AI and roadmaps', () => {
    const selected = activeIssues([
      issue(289, 'M01'),
      issue(381, 'M02', 'type:epic'),
      issue(379, 'M08'),
      issue(353, 'M03', 'type:roadmap'),
      issue(401, 'M02', 'type:task', { pull_request: {} }),
      issue(500, 'M01', 'type:task', { state: 'closed' }),
    ]);
    assert.deepEqual(
      selected.map(({ number }) => number),
      [289, 381],
    );
  });

  it('fails closed on bad or conflicting milestones', () => {
    assert.throws(
      () => activeIssues([issue(289, 'M01', 'type:task', { milestone: null })]),
      /milestone/,
    );
    const both = issue(290, 'M01');
    both.labels.push({ name: 'phase:M02' });
    assert.throws(() => activeIssues([both]), /multiple phases/);
  });

  it('preserves existing Status IDs before adding six ordered stages', () => {
    const field = {
      options: [
        { name: 'Todo', id: '1' },
        { name: 'In Progress', id: '2' },
        { name: 'Done', id: '3' },
      ],
    };
    const options = statusOptions(field);
    assert.deepEqual(
      options.map(({ name }) => name),
      STAGES.map(([name]) => name),
    );
    assert.equal(options[0].id, '1');
    assert.equal(options[2].id, '2');
    assert.equal(options[5].id, '3');
    assert.equal(statusOptions({ options }), null);
    assert.throws(() => statusOptions({ options: [{ name: 'Custom' }] }), /customized/);
  });

  it('never duplicates a board or an existing Issue item', () => {
    const projects = [{ title: 'Gym Platform Delivery', number: 5 }];
    assert.equal(existingProject(projects)?.number, 5);
    assert.throws(() => existingProject([...projects, ...projects]), /More than one/);
    const selected = activeIssues([issue(289, 'M01'), issue(290, 'M01')]);
    assert.deepEqual(
      missingIssues(selected, [{ content: { url: selected[0].url } }]).map(({ number }) => number),
      [290],
    );
  });
});

// TEMP_PRETTIER_DIFF_BEGIN
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import prettier from 'prettier';

it('temporary: show script Prettier differences', async () => {
  const file = resolve('scripts/github-project-setup.mjs');
  const before = readFileSync(file, 'utf8');
  const after = await prettier.format(before, {
    ...(await prettier.resolveConfig(file)),
    filepath: file,
  });
  const folder = mkdtempSync(join(tmpdir(), 'project-format-'));
  const a = join(folder, 'before.txt');
  const b = join(folder, 'after.txt');
  writeFileSync(a, before);
  writeFileSync(b, after);
  const result = spawnSync('diff', ['-u', a, b], { encoding: 'utf8' });
  console.log('PROJECT_FORMAT_DIFF\n' + result.stdout);
  rmSync(folder, { recursive: true, force: true });
});
