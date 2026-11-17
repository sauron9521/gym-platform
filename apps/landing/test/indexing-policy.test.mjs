import assert from 'node:assert/strict';
import { test } from 'vitest';

import { isIndexingEnabled } from '../src/shared/lib/seo.ts';

test('indexing requires explicit opt-in and a valid HTTPS production origin', () => {
  const previousUrl = process.env.LANDING_SITE_URL;
  const previousIndex = process.env.LANDING_ALLOW_INDEXING;
  try {
    process.env.LANDING_SITE_URL = 'https://gym.example.test';
    delete process.env.LANDING_ALLOW_INDEXING;
    assert.equal(isIndexingEnabled(), false);
    process.env.LANDING_ALLOW_INDEXING = 'true';
    assert.equal(isIndexingEnabled(), true);
    process.env.LANDING_SITE_URL = 'http://localhost:3002';
    assert.equal(isIndexingEnabled(), false);
  } finally {
    if (previousUrl === undefined) delete process.env.LANDING_SITE_URL;
    else process.env.LANDING_SITE_URL = previousUrl;
    if (previousIndex === undefined) delete process.env.LANDING_ALLOW_INDEXING;
    else process.env.LANDING_ALLOW_INDEXING = previousIndex;
  }
});
