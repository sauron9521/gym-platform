import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { writeMetricsFile } from './monitoring-textfile.mjs';

test('backup metrics are published atomically and never use arbitrary destinations', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'gym-backup-metrics-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'gym_api_backup.prom');

  await writeMetricsFile(path, 'gym_api_backup_verified 1\n');
  assert.equal(await readFile(path, 'utf8'), 'gym_api_backup_verified 1\n');
  assert.equal((await stat(path)).mode & 0o777, 0o640);

  await assert.rejects(writeMetricsFile(join(directory, 'missing', 'gym_api_backup.prom'), 'bad'));
  assert.equal(await readFile(path, 'utf8'), 'gym_api_backup_verified 1\n');

  await assert.rejects(writeMetricsFile('../relative.prom', 'bad'));
  await assert.rejects(writeMetricsFile(join(directory, 'not-metrics.txt'), 'bad'));
  await writeMetricsFile(path, 'gym_api_backup_verified 0\n');
  assert.equal(await readFile(path, 'utf8'), 'gym_api_backup_verified 0\n');
});

test('operator timers are opt-in and point to monorepo scripts and matching services', async () => {
  const files = {
    backupService: '../ops/backup/gym-platform-api-backup.service',
    backupTimer: '../ops/backup/gym-platform-api-backup.timer',
    healthService: '../ops/backup/gym-platform-api-backup-health.service',
    healthTimer: '../ops/backup/gym-platform-api-backup-health.timer',
    backupEnv: '../ops/backup/backup.env.example',
    healthEnv: '../ops/backup/backup-health.env.example',
  };
  const contents = Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, path]) => [
        key,
        await readFile(new URL(path, import.meta.url), 'utf8'),
      ]),
    ),
  );

  assert.match(contents.backupService, /ExecStart=\/usr\/bin\/bash \/opt\/gym-platform\/scripts\/backup-production\.sh/);
  assert.match(contents.backupService, /EnvironmentFile=\/etc\/gym-platform\/backup\.env/);
  assert.match(contents.backupService, /UMask=0077/);
  assert.match(contents.backupTimer, /Unit=gym-platform-api-backup\.service/);
  assert.match(contents.backupTimer, /OnCalendar=\*-\*-\* 03:30:00/);
  assert.match(contents.healthService, /ExecStart=\/usr\/bin\/env node \/opt\/gym-platform\/scripts\/monitoring-backup-health\.mjs/);
  assert.match(contents.healthService, /EnvironmentFile=\/etc\/gym-platform\/backup-health\.env/);
  assert.match(contents.healthTimer, /Unit=gym-platform-api-backup-health\.service/);
  assert.match(contents.healthTimer, /OnCalendar=\*:0\/15/);
  assert.match(contents.backupEnv, /AVATAR_VOLUME=gym-platform-api_avatars/);
  assert.match(contents.healthEnv, /BACKUP_TEXTFILE_PATH=.*gym_api_backup\.prom/);

  for (const content of Object.values(contents)) {
    assert.doesNotMatch(content, /\/opt\/gym-api\b|\/etc\/gym-api\b|gym-api_avatars/);
  }
});

test('backup remains outside API startup and production release workflows', async () => {
  const compose = await readFile(
    new URL('../infra/docker/compose.prod.yaml', import.meta.url),
    'utf8',
  );
  const publish = await readFile(
    new URL('../.github/workflows/publish-ghcr.yml', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(compose, /\bbackup-production\.sh\b|\brestore-drill\.sh\b/);
  assert.doesNotMatch(publish, /\bbackup-production\.sh\b|\brestore-drill\.sh\b/);
  assert.match(compose, /name: gym-platform-api/);
  assert.match(compose, /avatars:\/app\/uploads\/avatars/);
});
