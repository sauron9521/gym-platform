import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'vitest';

import {
  applicationNavigation,
  mainNavigation,
  publicRoutes,
} from '../src/shared/config/navigation.ts';
import { getSiteOrigin, pageMetadata, siteName } from '../src/shared/lib/seo.ts';

test('all public navigation links point to existing app-router pages', () => {
  const routes = new Set(publicRoutes);
  for (const link of [...mainNavigation, ...applicationNavigation]) {
    assert.ok(routes.has(link.href), 'Link missing from publicRoutes: ' + link.href);
  }
  assert.equal(new Set(publicRoutes).size, publicRoutes.length);
  for (const route of publicRoutes) {
    const page = '../src/app' + (route === '/' ? '' : route) + '/page.tsx';
    assert.ok(existsSync(new URL(page, import.meta.url)), 'Missing page: ' + page);
  }
});

test('SEO origin remains disabled without a canonical HTTPS origin', () => {
  const previous = process.env.LANDING_SITE_URL;
  try {
    for (const invalid of [
      '',
      'http://localhost:3002',
      'http://example.test',
      'https://example.test/path',
      'https://user:pass@example.test',
      'https://example.test/?x=1',
      'not a URL',
    ]) {
      process.env.LANDING_SITE_URL = invalid;
      assert.equal(getSiteOrigin(), null, invalid);
    }
    delete process.env.LANDING_SITE_URL;
    assert.equal(getSiteOrigin(), null);
  } finally {
    if (previous === undefined) delete process.env.LANDING_SITE_URL;
    else process.env.LANDING_SITE_URL = previous;
  }
});

test('explicit HTTPS origin creates canonical and social metadata', () => {
  const previous = process.env.LANDING_SITE_URL;
  try {
    process.env.LANDING_SITE_URL = 'https://gym.example.test';
    assert.equal(getSiteOrigin(), 'https://gym.example.test');
    const metadata = pageMetadata({
      title: 'Можливості',
      description: 'Огляд застосунків',
      path: '/features',
    });
    assert.equal(metadata.alternates?.canonical, 'https://gym.example.test/features');
    assert.equal(metadata.openGraph?.url, 'https://gym.example.test/features');
    assert.equal(metadata.openGraph?.siteName, siteName);
    assert.equal(siteName, 'OVRANTO');
  } finally {
    if (previous === undefined) delete process.env.LANDING_SITE_URL;
    else process.env.LANDING_SITE_URL = previous;
  }
});
