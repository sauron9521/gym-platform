import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { parse } from 'yaml';

const config = parse(readFileSync(new URL('../.github/dependabot.yml', import.meta.url), 'utf8'));

test('Dependabot config covers the repository package managers and their directories', () => {
  assert.equal(config.version, 2);
  assert.ok(Array.isArray(config.updates), 'Dependabot updates must be a list');

  for (const [ecosystem, directory] of [
    ['npm', '/'],
    ['github-actions', '/'],
    ['docker', '/apps/api'],
    ['docker-compose', '/infra/docker'],
  ]) {
    const target = config.updates.find(
      (entry) =>
        entry['package-ecosystem'] === ecosystem &&
        (entry.directory === directory || entry.directories?.includes(directory)),
    );
    assert.ok(target, ecosystem + ' is missing for ' + directory);
    assert.ok(target.schedule?.interval, ecosystem + ' is missing an update interval');
  }
});

test('Dependabot groups apply to version updates and leave major updates for individual review', () => {
  for (const update of config.updates) {
    for (const [name, group] of Object.entries(update.groups ?? {})) {
      const label = update['package-ecosystem'] + '/' + name;
      assert.equal(group['applies-to'], 'version-updates', label);
      const types = group['update-types'];
      assert.ok(Array.isArray(types) && types.length > 0, label + ' must specify update types');
      for (const type of types) {
        assert.ok(type === 'minor' || type === 'patch', label + ' groups ' + type + ' updates');
      }
    }
  }
});
