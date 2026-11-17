import { expect, test } from '@playwright/test';

for (const route of ['/', '/features', '/this-route-does-not-exist']) {
  test(`Landing security headers protect ${route}`, async ({ request }) => {
    const response = await request.get(route);
    if (route === '/this-route-does-not-exist') {
      expect(response.status()).toBe(404);
    } else {
      expect(response.ok()).toBe(true);
    }

    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['permissions-policy']).toContain('microphone=()');
    expect(headers['permissions-policy']).toContain('geolocation=()');
    expect(headers['x-powered-by']).toBeUndefined();
  });
}
