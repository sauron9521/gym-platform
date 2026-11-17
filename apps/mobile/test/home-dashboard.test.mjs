import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';

const screen = readFileSync(new URL('../src/screens/home/ui/home-screen.tsx', import.meta.url), 'utf8');
test('dashboard uses real workouts, programs and progress queries', () => {
  expect(screen).toContain('useWorkoutsQuery()');
  expect(screen).toContain('useProgramAssignments()');
  expect(screen).toContain("useWorkoutSummary('7d')");
  expect(screen).not.toContain('API Planned');
  expect(screen).not.toContain('Mobile is ready for development');
});
test('athlete-only actions do not appear for trainer accounts', () => {
  expect(screen).toContain("account?.role === 'ATHLETE'");
  expect(screen).toContain('{isAthlete ? (');
});
