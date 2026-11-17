import { expect, test } from '@playwright/test';

test('landing serves public social previews and an explicit indexing policy', async ({
  page,
  request,
}) => {
  await page.goto('/');

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/opengraph-image/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /index, follow/,
  );

  const schema = page.locator('script[type="application/ld+json"]');
  await expect(schema).toHaveCount(1);
  expect(JSON.parse((await schema.textContent()) ?? '{}')).toMatchObject({
    '@type': 'Organization',
    name: 'Gym Platform',
    url: 'https://gym.example.test',
    logo: 'https://gym.example.test/icon.svg',
  });

  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain('Allow: /');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain('https://gym.example.test/apps');

  const image = await request.get('/opengraph-image');
  expect(image.ok()).toBeTruthy();
  expect(image.headers()['content-type']).toContain('image/png');
  expect((await image.body()).byteLength).toBeGreaterThan(0);
});
