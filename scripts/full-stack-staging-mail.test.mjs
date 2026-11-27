import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { X509Certificate } from 'node:crypto';
import { test } from 'vitest';
import { createMailOverlay, mailSettings } from './full-stack-staging-mail.mjs';

test('disposable SMTPS uses a pinned local sink, restricted recipients and read-only trust material', () => {
  const dir = mkdtempSync(join(tmpdir(), 'staging-mail-test-'));
  try {
    const overlay = createMailOverlay(dir);
    const { api, mailpit } = overlay.yaml.services;
    assert.equal(mailSettings.SMTP_URL, 'smtps://mailpit:465');
    assert.equal(mailSettings.SMTP_RECIPIENT_ALLOWLIST, 'fixture@example.test');
    assert.match(mailpit.image, /^axllent\/mailpit@sha256:[a-f0-9]{64}$/);
    assert.ok(mailpit.command.includes('--smtp-require-tls'));
    assert.ok(mailpit.command.includes('^fixture@example[.]test$'));
    assert.ok(!mailpit.command.some((arg) => /relay|forward|insecure/.test(arg)));
    assert.equal(mailpit.ports, undefined);
    assert.equal(api.environment.NODE_EXTRA_CA_CERTS, '/run/rehearsal-smtp.crt');
    assert.deepEqual(api.volumes, [
      { type: 'bind', source: overlay.cert, target: '/run/rehearsal-smtp.crt', read_only: true },
    ]);
    assert.ok(mailpit.volumes.every((v) => v.read_only));
    assert.equal(statSync(overlay.key).mode & 0o777, 0o600);
    const cert = new X509Certificate(readFileSync(overlay.cert));
    assert.equal(cert.checkHost('mailpit'), 'mailpit');
    assert.equal(cert.checkHost('external.example.test'), undefined);
    assert.ok(cert.verify(cert.publicKey));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
