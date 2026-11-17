import { describe, expect, it } from 'vitest';

import { getCorsOrigins, getCsrfTrustedOrigins } from '../http.config.js';

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

  it('never broadens the allowlist to wildcard or unknown origins', () => {
    const trusted = getCsrfTrustedOrigins('http://localhost:3000', [
      'http://localhost:8081',
    ]);
    expect(trusted).not.toContain('https://untrusted.example.test');
    expect(trusted).not.toContain('*');
  });
});
