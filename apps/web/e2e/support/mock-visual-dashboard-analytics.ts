import type { Page } from '@playwright/test';

// Synthetic, fixed review evidence only. Never used by the production API.
// Keep this isolated from the shared HTTP fixture so error/429 browser tests
// can continue exercising their original behavior.
export async function mockVisualDashboardAnalytics(page: Page) {
  await page.route('**/backend/workout-analytics/personal-records*', (route) =>
    route.fulfill({
      status: 200,
      json: { exerciseCount: 3, asOf: '2026-11-19T09:00:00.000Z' },
    }),
  );

  await page.route('**/backend/workout-analytics/summary*', (route) =>
    route.fulfill({
      status: 200,
      json: {
        asOf: '2026-11-19T09:00:00.000Z',
        workoutCount: 4,
        activeDays: 6,
        daily: [
          { date: '2026-11-12', strengthVolumeKg: 1200 },
          { date: '2026-11-13', strengthVolumeKg: 0 },
          { date: '2026-11-14', strengthVolumeKg: 2100 },
          { date: '2026-11-15', strengthVolumeKg: 1550 },
          { date: '2026-11-16', strengthVolumeKg: 0 },
          { date: '2026-11-17', strengthVolumeKg: 2600 },
          { date: '2026-11-18', strengthVolumeKg: 1950 },
        ],
      },
    }),
  );
}
