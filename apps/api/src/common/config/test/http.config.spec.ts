import { describe, expect, it } from 'vitest';

import { getCorsOrigins, getCsrfTrustedOrigins, getSessionTrustedOrigins } from '../http.config.js';

describe('browser origins for CORS and CSRF', () => {
  it('trusts only the explicitly configured web and Expo origins', () => {
    const appUrl = 'http://localhost:3000';
    const cors = getCorsOrigins('http://localhost:3000,http://localhost:8081');
    expect(getCsrfTrustedOrigins(appUrl, cors)).toEqual([
      'http://localhost:3000',
      'http://localhost:8081',
    ]);
  });

  it('includes the session app origin even if the API CORS list omits it', () => {
    expect(
      getCsrfTrustedOrigins('https://web.example.test', ['https://mobile-web.example.test']),
    ).toEqual(['https://web.example.test', 'https://mobile-web.example.test']);
  });

  it('allows the separately configured Trainer origin for CSRF and cookie sessions', () => {
    const web = 'https://athlete.example.test';
    const admin = 'https://admin.example.test';
    const trainer = 'https://trainer.example.test';
    expect(getSessionTrustedOrigins(web, admin, trainer)).toEqual([web, admin, trainer]);
    expect(getCsrfTrustedOrigins(web, [web], admin, trainer)).toEqual([web, admin, trainer]);
    expect(getSessionTrustedOrigins(web)).toEqual([web]);
    expect(getSessionTrustedOrigins(web, undefined, trainer)).toEqual([web, trainer]);
  });

  it('never broadens the allowlist to wildcard or unknown origins', () => {
    const trusted = getCsrfTrustedOrigins('http://localhost:3000', ['http://localhost:8081']);
    expect(trusted).not.toContain('https://untrusted.example.test');
    expect(trusted).not.toContain('*');
  });
});
