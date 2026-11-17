import { describe, expect, it } from 'vitest';

import { getTrustedSessionOrigins } from '../http.config.js';
import { envSchema } from '../env.schema.js';

describe('separate Admin browser origin', () => {
  it('trusts only the explicitly configured Admin and Web origins', () => {
    const origins = getTrustedSessionOrigins('https://app.example.test', 'https://admin.example.test');
    expect(origins).toEqual(['https://app.example.test', 'https://admin.example.test']);
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
    const valid = envSchema.safeParse({ ...base, ADMIN_APP_URL: 'http://localhost:3003' });
    const path = envSchema.safeParse({ ...base, ADMIN_APP_URL: 'https://other.test/path' });
    const credentials = envSchema.safeParse({ ...base, ADMIN_APP_URL: 'https://a.test@evil.test' });
    expect(valid.success).toBe(true);
    expect(path.success).toBe(false);
    expect(credentials.success).toBe(false);
  });
});
