// Restore synthetic data only, from the already validated disposable stack.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const postgresImage =
  'postgres:17-alpine@sha256:526f86d93c6ea08fd3f1fe5605650cacc781b2c6013169a0ad8f42c7d3d84f32';
export function recoveryNames(project) {
  assert.match(project, /^ovranto-rehearsal-[a-f0-9]{16}$/);
  return {
    source: 'gym_rehearsal',
    target: 'gym_rehearsal_restore_test',
    volume: project + '_restored_avatars',
  };
}
export async function probeFullStackRecovery({ project, directory, compose, output, options }) {
  const names = recoveryNames(project);
  const docker = (...args) => execFileSync('docker', args, { ...options, timeout: 120000 }).trim();
  const pg = output('ps', '-q', 'postgres');
  const api = output('ps', '-q', 'api');
  for (const [id, service] of [
    [pg, 'postgres'],
    [api, 'api'],
  ]) {
    assert.match(id, /^[a-f0-9]{12,64}$/);
    const info = JSON.parse(docker('inspect', id))[0];
    assert.equal(info.Config.Labels['com.docker.compose.project'], project);
    assert.equal(info.Config.Labels['com.docker.compose.service'], service);
  }
  const userId = randomUUID(),
    profileId = randomUUID(),
    avatar = randomUUID() + '.png';
  const bytes = randomBytes(128);
  const sha = createHash('sha256').update(bytes).digest('hex');
  const sql = (db, statement) =>
    docker(
      'exec',
      pg,
      'psql',
      '-X',
      '-Atq',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'rehearsal',
      '-d',
      db,
      '-c',
      statement,
    );
  const readFixture = (db) =>
    sql(
      db,
      "SELECT u.id || '|' || p.weight || '|' || p.avatar_key FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id='" +
        userId +
        "'",
    );
  const migrations = (db) =>
    sql(
      db,
      "SELECT migration_name || '|' || checksum FROM _prisma_migrations ORDER BY migration_name",
    );
  assert.equal(sql(names.source, 'SELECT current_database()'), names.source);
  // No live requests are served by this network. Stop API writers before snapshot.
  docker(
    'exec',
    api,
    'node',
    '-e',
    "require('node:fs').writeFileSync('/app/uploads/avatars/" +
      avatar +
      "',Buffer.from('" +
      bytes.toString('hex') +
      "','hex'),{flag:'wx'})",
  );
  compose('stop', 'api');
  sql(
    names.source,
    "INSERT INTO users(id,email,password_hash,updated_at) VALUES ('" +
      userId +
      "','recovery@example.test','unusable-synthetic-fixture',now()); INSERT INTO profiles(id,user_id,weight,avatar_key,updated_at) VALUES ('" +
      profileId +
      "','" +
      userId +
      "',81.25,'" +
      avatar +
      "',now())",
  );
  const expected = userId + '|81.25|' + avatar;
  assert.equal(readFixture(names.source), expected);
  const ledger = migrations(names.source);
  assert.ok(ledger.length > 0);
  const sourceVolume = project + '_avatars';
  const volumeInfo = JSON.parse(docker('volume', 'inspect', sourceVolume))[0];
  assert.equal(volumeInfo.Labels['com.docker.compose.project'], project);
  assert.equal(volumeInfo.Labels['com.docker.compose.volume'], 'avatars');
  const archiveDir = '/tmp/recovery-probe';
  const backupStart = performance.now();
  docker('exec', pg, 'mkdir', '-m', '700', archiveDir);
  docker(
    'exec',
    pg,
    'pg_dump',
    '-U',
    'rehearsal',
    '-d',
    names.source,
    '-Fc',
    '--no-owner',
    '--no-acl',
    '-f',
    archiveDir + '/postgres.dump',
  );
  const archive = execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '--network',
      'none',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--mount',
      'type=volume,src=' + sourceVolume + ',dst=/avatars,readonly',
      '--entrypoint',
      'tar',
      postgresImage,
      '-czf',
      '-',
      '-C',
      '/avatars',
      '.',
    ],
    { ...options, encoding: null, maxBuffer: 1024 * 1024, timeout: 120000 },
  );
  const localArchive = join(directory, 'avatars.tar.gz');
  writeFileSync(localArchive, archive, { mode: 0o600, flag: 'wx' });
  docker('cp', localArchive, pg + ':' + archiveDir + '/avatars.tar.gz');
  docker(
    'exec',
    pg,
    'sh',
    '-eu',
    '-c',
    'cd /tmp/recovery-probe; sha256sum postgres.dump avatars.tar.gz > SHA256SUMS; printf "consistency=quiesced-synthetic-fixture\\n" > MANIFEST.txt',
  );
  docker(
    'cp',
    fileURLToPath(new URL('./restore-drill.sh', import.meta.url)),
    pg + ':/tmp/restore-drill.sh',
  );
  const backupMs = Math.round(performance.now() - backupStart);
  const restoreStart = performance.now();
  docker('exec', pg, 'createdb', '-U', 'rehearsal', names.target);
  const restore = () =>
    docker(
      'exec',
      '-e',
      'RESTORE_DRILL_CONFIRM=I_ACKNOWLEDGE_ISOLATED_RESTORE',
      '-e',
      'DATABASE_URL=postgresql://rehearsal@/' + names.source,
      '-e',
      'RESTORE_DATABASE_URL=postgresql://rehearsal@/' + names.target,
      pg,
      'sh',
      '/tmp/restore-drill.sh',
      archiveDir,
    );
  // Exercise the existing guard before a successful restore.
  docker('exec', pg, 'sh', '-eu', '-c', 'printf x >> /tmp/recovery-probe/avatars.tar.gz');
  assert.throws(restore, /Backup validation failed/);
  assert.equal(sql(names.target, "SELECT count(*) FROM pg_tables WHERE schemaname='public'"), '0');
  docker('cp', localArchive, pg + ':' + archiveDir + '/avatars.tar.gz');
  restore();
  assert.equal(readFixture(names.target), expected);
  assert.equal(migrations(names.target), ledger);
  assert.throws(restore, /Restore database is not empty/); // The non-empty target must never be overwritten.
  assert.equal(readFixture(names.target), expected);
  assert.equal(readFixture(names.source), expected);
  // Extract only the exact synthetic archive into a new, empty, owned volume.
  assert.throws(() => docker('volume', 'inspect', names.volume));
  const created = docker(
    'volume',
    'create',
    '--label',
    'ovranto.rehearsal=' + project,
    names.volume,
  );
  assert.equal(created, names.volume);
  try {
    const restored = execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '-i',
        '--network',
        'none',
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--mount',
        'type=volume,src=' + names.volume + ',dst=/restored',
        '--entrypoint',
        'sh',
        postgresImage,
        '-eu',
        '-c',
        'test -z "$(ls -A /restored)"; tar -xzf - -C /restored --no-same-owner; sha256sum /restored/' +
          avatar,
      ],
      { ...options, input: archive, encoding: 'utf8', timeout: 120000 },
    ).trim();
    assert.equal(restored.split(/\s+/)[0], sha);
  } finally {
    docker('volume', 'rm', names.volume);
  }
  const restoreMs = Math.round(performance.now() - restoreStart);
  console.log(
    'Recovery rehearsal PASS: actual PostgreSQL dump/guarded restore, migration ledger, profile decimal, avatar SHA-256, tamper and nonempty-target refusal; synthetic backup ' +
      backupMs +
      'ms, restore ' +
      restoreMs +
      'ms (not production RPO/RTO).',
  );
}
