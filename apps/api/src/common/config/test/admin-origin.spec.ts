import { describe, expect, it } from 'vitest';

import { getTrustedSessionOrigins } from '../http.config.js';
import { envSchema } from '../env.schema.js';

describe('separate Admin browser origin', () => {
  it('trusts only the explicitly configured Admin and Web origins', () => {
    expect(
      getTrustedSessionOrigins('https://app.example.test', 'https://admin.example.test'),
    ).toEqual(['https://app.example.test', 'https://admin.example.test']);
  });

  it('rejects malformed admin origins instead of weakening CSRF protection', () => {
    const base = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gym',
      JWT_SECRET: 'test-secret',
      JWT_ISSUER: 'http://localhost:3001',
      APP_URL: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:3000',
    };
    expect(envSchema.safeParse({ ...base, ADMIN_APP_URL: 'http://localhost:3003' }).success).toBe(
      true,
    );
    expect(envSchema.safeParse({ ...base, ADMIN_APP_URL: 'https://other.test/path' }).success).toBe(
      false,
    );
    expect(envSchema.safeParse({ ...base, ADMIN_APP_URL: 'https://a.test@evil.test' }).success).toBe(
      false,
    );
  });
});
