import { describe, expect, it } from 'vitest';

import { getCsrfTrustedOrigins, getSessionTrustedOrigins } from '../http.config.js';
import { envSchema } from '../env.schema.js';

const development = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gym',
  JWT_SECRET: 'test-secret',
  JWT_ISSUER: 'http://localhost:3001',
  APP_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:3000,http://localhost:8081',
};

describe('Admin session origin isolation', () => {
  it('retains Expo CORS/CSRF compatibility while adding the explicitly trusted Admin', () => {
    const web = 'https://web.example.test';
    const expo = 'https://expo.example.test';
    const admin = 'https://admin.example.test';
    expect(getCsrfTrustedOrigins(web, [expo], admin)).toEqual([web, expo, admin]);
    expect(getCsrfTrustedOrigins(web, [expo])).toEqual([web, expo]);
    expect(getSessionTrustedOrigins(web, admin)).toEqual([web, admin]);
    expect(getSessionTrustedOrigins(web)).toEqual([web]);
    expect(getSessionTrustedOrigins(web, web)).toEqual([web]);
  });

  it('rejects invalid origins and accepts only an exact development origin', () => {
    expect(envSchema.safeParse({ ...development, ADMIN_APP_URL: '' }).success).toBe(true);
    expect(
      envSchema.safeParse({ ...development, ADMIN_APP_URL: 'http://localhost:3003' }).success,
    ).toBe(true);
    for (const invalid of [
      'https://other.test/path',
      'https://user:pass@other.test',
      'https://other.test?token=unsafe',
      'https://other.test/',
      'file:///etc/passwd',
      '*',
    ]) {
      expect(envSchema.safeParse({ ...development, ADMIN_APP_URL: invalid }).success).toBe(false);
    }
  });

  it('requires an HTTPS Admin origin in production', () => {
    const production = {
      ...development,
      NODE_ENV: 'production',
      JWT_SECRET: '7tQzM8veL3hrC9spF6jW2baX5kYeP4nB',
      JWT_ISSUER: 'https://api.example.test',
      APP_URL: 'https://app.example.test',
      CORS_ORIGINS: 'https://app.example.test',
      SMTP_URL: 'smtps://mailer.example.test:465',
      MAIL_FROM: 'Gym API <no-reply@example.test>',
    };
    expect(
      envSchema.safeParse({ ...production, ADMIN_APP_URL: 'https://admin.example.test' }).success,
    ).toBe(true);
    expect(
      envSchema.safeParse({ ...production, ADMIN_APP_URL: 'http://admin.example.test' }).success,
    ).toBe(false);
  });
});
