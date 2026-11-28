import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMailOverlay, mailSettings, probeStagingMail } from './full-stack-staging-mail.mjs';
import { probeConnectionBudget } from './full-stack-connection-budget.mjs';
import { probeFullStackRecovery } from './full-stack-recovery.mjs';
import { probeStagingEdge } from './full-stack-staging-edge.mjs';

export async function runFullStackRehearsal({ signedImages } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const project = 'ovranto-rehearsal-' + randomBytes(8).toString('hex');
  const directory = mkdtempSync(join(tmpdir(), 'ovranto-rehearsal-'));
  const envFile = join(directory, 'rehearsal.env');
  const password = randomBytes(24).toString('hex');
  const values = {
    REHEARSAL_PROJECT: project,
    REHEARSAL_DB_PASSWORD: password,
    DATABASE_URL: 'postgresql://rehearsal:' + password + '@postgres:5432/gym_rehearsal',
    REDIS_URL: 'redis://redis:6379',
    JWT_SECRET: randomBytes(48).toString('hex'),
    JWT_ISSUER: 'https://api.rehearsal.invalid',
    APP_URL: 'https://app.rehearsal.invalid',
    ADMIN_APP_URL: 'https://admin.rehearsal.invalid',
    TRAINER_APP_URL: 'https://coach.rehearsal.invalid',
    CORS_ORIGINS:
      'https://app.rehearsal.invalid,https://admin.rehearsal.invalid,https://coach.rehearsal.invalid',
    ...mailSettings,
  };
  writeFileSync(
    envFile,
    Object.entries(values)
      .map(([k, v]) => k + '=' + v)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
  // Do not inherit DATABASE_URL, SMTP credentials, COMPOSE_* or feature flags.
  const env = Object.fromEntries(
    [
      'PATH',
      'HOME',
      'USER',
      'LANG',
      'LC_ALL',
      'DOCKER_CONFIG',
      'XDG_RUNTIME_DIR',
      'SYSTEMROOT',
      'USERPROFILE',
      'APPDATA',
      'TEMP',
      'TMP',
      'HTTPS_PROXY',
      'HTTP_PROXY',
      'NO_PROXY',
    ]
      .filter((k) => process.env[k] !== undefined)
      .map((k) => [k, process.env[k]]),
  );
  env.COMPOSE_PARALLEL_LIMIT = '1';
  const args = [
    'compose',
    '--project-name',
    project,
    '--env-file',
    envFile,
    '-f',
    'infra/docker/compose.prod.yaml',
    '-f',
    'infra/docker/compose.full-stack.yaml',
    '-f',
    'infra/docker/compose.rehearsal.yaml',
  ];
  const mail = createMailOverlay(directory);
  const mailOverlay = join(directory, 'mail.json');
  writeFileSync(mailOverlay, JSON.stringify(mail.yaml), { mode: 0o600 });
  args.push('-f', mailOverlay);
  const imageServices = ['api', 'landing', 'web', 'trainer', 'admin', 'migrate'];
  const expectedImages = Object.fromEntries(
    imageServices.map((service) => [
      service,
      signedImages
        ? signedImages[service === 'api' ? 'runtime' : service].ref
        : project + '-' + service + ':local',
    ]),
  );
  if (signedImages) {
    const override = join(directory, 'signed-digests.yaml');
    writeFileSync(
      override,
      'services:\n' +
        imageServices
          .map(
            (service) =>
              '  ' +
              service +
              ':\n    image: ' +
              expectedImages[service] +
              '\n    build: !reset null\n',
          )
          .join(''),
      { mode: 0o600 },
    );
    args.push('-f', override);
  }
  const options = { cwd: root, env, encoding: 'utf8', timeout: 15 * 60 * 1000 };
  const compose = (...command) =>
    execFileSync('docker', [...args, ...command], { ...options, stdio: 'inherit' });
  const output = (...command) => execFileSync('docker', [...args, ...command], options).trim();
  const services = ['api', 'landing', 'web', 'trainer', 'admin'];
  let validated = false;
  try {
    const config = JSON.parse(output('--profile', 'ops', 'config', '--format', 'json'));
    assert.equal(config.name, project);
    assert.equal(config.networks.default.internal, true);
    for (const [name, service] of Object.entries(config.services)) {
      assert.ok(!service.ports?.length, name + ' publishes a port');
      assert.ok(!service.container_name, name + ' uses a fixed container name');
      for (const v of service.volumes ?? []) {
        if (v.type !== 'bind') continue;
        const permitted =
          (name === 'api' && v.source === mail.cert && v.target === '/run/rehearsal-smtp.crt') ||
          (name === 'mailpit' &&
            ((v.source === mail.cert && v.target === '/certs/smtp.crt') ||
              (v.source === mail.key && v.target === '/certs/smtp.key')));
        assert.ok(permitted && v.read_only === true, name + ' has an unexpected host bind mount');
      }
    }
    for (const volume of Object.values(config.volumes)) {
      assert.ok(
        !volume.external && volume.name.startsWith(project + '_'),
        'Unexpected external volume',
      );
    }
    assert.equal(config.services.api.environment.DATABASE_URL, values.DATABASE_URL);
    assert.equal(config.services.migrate.environment.DATABASE_URL, values.DATABASE_URL);
    assert.equal(config.services.api.environment.REDIS_URL, values.REDIS_URL);
    assert.equal(config.services.api.environment.SMTP_URL, values.SMTP_URL);
    assert.deepEqual(config.services.migrate.profiles, ['ops']);
    for (const service of imageServices) {
      assert.equal(config.services[service].image, expectedImages[service]);
      if (signedImages) {
        assert.match(
          expectedImages[service],
          /^ghcr\.io\/[a-z0-9_.-]+\/[a-z0-9_.-]+@sha256:[a-f0-9]{64}$/,
        );
        assert.ok(!config.services[service].build, 'Signed service cannot rebuild');
      }
    }
    validated = true;
    if (!signedImages) compose('--profile', 'ops', 'build', ...imageServices);
    compose('up', '-d', '--wait', '--wait-timeout', '120', 'postgres', 'redis', 'mailpit');
    // Explicit one-shot migration into the new disposable database, never auto-seed.
    compose('--profile', 'ops', 'run', '--rm', '--no-deps', '--pull', 'never', 'migrate');
    compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '180', ...services);
    const probe = (service, code) => compose('exec', '-T', service, 'node', '-e', code);
    probe(
      'api',
      "fetch('http://127.0.0.1:3000/health/ready').then(async r=>{if(r.status!==200||(await r.json()).status!=='ok')process.exit(1)})",
    );
    for (const [service, path] of [
      ['landing', '/uk'],
      ['web', '/login'],
      ['trainer', '/login'],
      ['admin', '/sign-in'],
    ]) {
      probe(
        service,
        "const assert=require('node:assert/strict');(async()=>{const r=await fetch('http://127.0.0.1:3000" +
          path +
          "');assert.equal(r.status,200);assert.ok((await r.text()).includes('<html'));assert.notEqual(process.getuid(),0)})().catch(e=>{console.error(e);process.exit(1)})",
      );
      if (service !== 'landing')
        probe(
          service,
          "const assert=require('node:assert/strict');(async()=>{const r=await fetch('http://127.0.0.1:3000/backend/health/ready');assert.equal(r.status,200);assert.equal((await r.json()).status,'ok')})().catch(e=>{console.error(e);process.exit(1)})",
        );
    }
    probeConnectionBudget({ project, output, config });
    probeStagingMail(compose);
    await probeStagingEdge({ project, directory, compose, output, options });
    await probeFullStackRecovery({ project, directory, compose, output, options });
    console.log(
      'Full-stack rehearsal PASS: five apps, disposable migrations, PostgreSQL/Redis readiness, three real API rewrites.',
    );
  } finally {
    try {
      if (validated) {
        // Only the random validated project is removed; never touch dev/production.
        compose('--profile', 'ops', 'down', '--volumes', '--remove-orphans');
        if (!signedImages)
          for (const service of imageServices)
            spawnSync('docker', ['image', 'rm', project + '-' + service + ':local'], {
              ...options,
              stdio: 'ignore',
            });
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('No direct digest overrides allowed');
  await runFullStackRehearsal();
}
