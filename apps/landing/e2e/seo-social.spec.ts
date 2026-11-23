import { expect, test } from '@playwright/test';

test('social previews and indexing work', async ({ page, request }) => {
  await page.goto('/');

  const ogImage = page.locator('meta[property="og:image"]');
  await expect(ogImage).toHaveAttribute('content', /\/opengraph-image/);

  await expect(page).toHaveTitle(/OVRANTO/);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'OVRANTO');

  const twitterCard = page.locator('meta[name="twitter:card"]');
  await expect(twitterCard).toHaveAttribute('content', 'summary_large_image');

  const robotsMeta = page.locator('meta[name="robots"]');
  await expect(robotsMeta).toHaveAttribute('content', /index, follow/);

  const schema = page.locator('script[type="application/ld+json"]');
  await expect(schema).toHaveCount(1);
  const jsonLd = (await schema.textContent()) ?? '{}';
  expect(JSON.parse(jsonLd)).toMatchObject({
    '@type': 'Organization',
    name: 'OVRANTO',
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
