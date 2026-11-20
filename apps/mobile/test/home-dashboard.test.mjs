import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const screen = readFileSync(
  new URL('../src/screens/home/ui/home-screen.tsx', import.meta.url),
  'utf8',
);

test('dashboard reads real workouts, assignments and seven-day analytics', () => {
  expect(screen).toContain('useWorkoutsQuery()');
  expect(screen).toContain('useProgramAssignments()');
  expect(screen).toContain("useWorkoutSummary('7d')");
  expect(screen).toContain('programs.data?.pages[0]?.meta.total');
  expect(screen).not.toContain('API Planned');
  expect(screen).not.toContain('Mobile is ready for development');
});

test('athlete-only query hooks live in a separate conditionally mounted child', () => {
  expect(screen).toContain('hasAthleteAccess(capabilities)');
  expect(screen).toContain('function AthleteDashboard()');
  expect(screen).toContain('isAthlete ? <AthleteDashboard /> : null');
  expect(screen).toContain("router.push('/progress')");
  expect(screen).toContain("router.push('/profile')");
});
