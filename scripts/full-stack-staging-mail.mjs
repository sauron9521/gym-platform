// Test-only SMTP endpoint with its own disposable certificate.
import { execFileSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';

const image =
  'axllent/mailpit@sha256:23a2ef85bc50853ab3093645d1d64679afd8887e89da5e48a88940c172591a4e';
export const mailSettings = {
  SMTP_URL: 'smtps://mailpit:465',
  SMTP_RECIPIENT_ALLOWLIST: 'fixture@example.test',
  MAIL_FROM: 'fixture@example.test',
};
export function createMailOverlay(directory) {
  const cert = join(directory, 'smtp.crt');
  const key = join(directory, 'smtp.key');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=mailpit',
      '-addext',
      'subjectAltName=DNS:mailpit',
      '-addext',
      'basicConstraints=critical,CA:TRUE',
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'ignore', timeout: 30000 },
  );
  chmodSync(key, 0o600);
  chmodSync(cert, 0o644);
  return {
    cert,
    key,
    yaml: {
      services: {
        mailpit: {
          image,
          command: [
            '--smtp',
            '0.0.0.0:465',
            '--smtp-tls-cert',
            '/certs/smtp.crt',
            '--smtp-tls-key',
            '/certs/smtp.key',
            '--smtp-require-tls',
            '--smtp-disable-rdns',
            '--smtp-allowed-recipients',
            '^fixture@example[.]test$',
          ],
          volumes: [
            { type: 'bind', source: cert, target: '/certs/smtp.crt', read_only: true },
            { type: 'bind', source: key, target: '/certs/smtp.key', read_only: true },
          ],
          healthcheck: {
            test: ['CMD', '/mailpit', 'readyz'],
            interval: '3s',
            timeout: '3s',
            retries: 30,
          },
        },
        api: {
          environment: { NODE_EXTRA_CA_CERTS: '/run/rehearsal-smtp.crt' },
          volumes: [
            { type: 'bind', source: cert, target: '/run/rehearsal-smtp.crt', read_only: true },
          ],
          depends_on: { mailpit: { condition: 'service_healthy' } },
        },
      },
    },
  };
}

// Exercise the compiled production mail configuration, not a replacement SMTP client.
const mailProbe = String.raw`
import assert from 'node:assert/strict';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Mailer, MailModule, MailMessageError } from '@nestjs/mail';
import { createMailOptions } from './dist/common/config/mail.config.js';
const options = createMailOptions(process.env, '/app/dist/mail/templates');
class ProbeModule {}
Module({imports:[MailModule.forRoot(options)]})(ProbeModule);
const app = await NestFactory.createApplicationContext(ProbeModule,{logger:false});
try {
  const mailer = app.get(Mailer);
  const content = {subject:'Disposable staging SMTP probe',text:'Synthetic transport check'};
  await mailer.send({...content,to:'fixture@example.test'});
  for (const recipients of [
    {to:'outside@example.test'},
    {to:'fixture@example.test',cc:'outside@example.test'},
    {to:'fixture@example.test',bcc:'outside@example.test'},
  ]) {
    await assert.rejects(mailer.send({...content,...recipients}),MailMessageError);
  }
  const response = await fetch('http://mailpit:8025/api/v1/messages',{signal:AbortSignal.timeout(5000)});
  assert.equal(response.status,200);
  const inbox = await response.json();
  assert.equal(inbox.total,1);
  assert.equal(inbox.messages[0].Subject,content.subject);
  assert.deepEqual(inbox.messages[0].To.map(x=>x.Address),['fixture@example.test']);
  console.log('Production mail transport over verified SMTPS, captured message and To/CC/BCC allowlist PASS');
} finally {
  await app.close();
}
`;
export function probeStagingMail(compose) {
  compose('exec', '-T', 'api', 'node', '--input-type=module', '-e', mailProbe);
}
