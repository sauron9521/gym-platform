import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('athlete tabs use approved order, vector icons and stable selectors', () => {
  const tabs = read('../src/app/(tabs)/_layout.tsx');
  assert.deepEqual(
    [...tabs.matchAll(/<Tabs\.Screen\s+name="(index|workouts|progress|profile|programs)"/g)].map(
      (m) => m[1],
    ),
    ['index', 'workouts', 'progress', 'profile'],
  );
  for (const tab of ['home', 'workouts', 'progress', 'profile']) {
    assert.ok(tabs.includes(`tabBarButtonTestID: 'mobile-tab-${tab}'`));
    assert.ok(tabs.includes(`<TabIcon name="${tab}"`));
  }
  assert.ok(tabs.includes("headerTitle: 'OVRANTO'"));
  assert.match(
    tabs,
    /<Tabs.Protected guard=\{hasAthleteAccess\(capabilities\)\}>\s*<Tabs.Screen\s+name="progress"/,
  );
});

test('public route paths remain unchanged and program list is protected', () => {
  assert.match(read('../src/app/(tabs)/progress.tsx'), /<ProgressScreen/);
  assert.match(read('../src/app/programs/index.tsx'), /<ProgramsScreen/);
  const layout = read('../src/app/_layout.tsx');
  const athlete = layout
    .split('<Stack.Protected guard={hasAthleteAccess(capabilities)}>')[1]
    .split('</Stack.Protected>')[0];
  for (const route of [
    'programs/index',
    'programs/[id]',
    'progress/exercises/[id]',
    'workouts/new',
    'workouts/calendar',
  ]) {
    assert.ok(athlete.includes(`name="${route}"`));
  }
  assert.match(
    read('../src/screens/workouts/ui/workouts-screen.tsx'),
    /router.push\('\/programs'\)/,
  );
});

test('app settings is reachable from profile and protected by mobile account access', () => {
  const layout = read('../src/app/_layout.tsx');
  const protectedRoutes = layout
    .split('<Stack.Protected guard={Boolean(account && hasMobileAccess(capabilities))}>')[1]
    .split('</Stack.Protected>')[0];
  assert.ok(protectedRoutes.includes('name="profile/settings"'));
  assert.match(read('../src/app/profile/settings.tsx'), /<AppSettingsScreen/);
  assert.match(
    read('../src/screens/profile/ui/profile-screen.tsx'),
    /router.push\('\/profile\/settings'\)/,
  );
});

test('calendar direct route requires verified athlete access and is account keyed', () => {
  const route = read('../src/app/workouts/calendar.tsx');
  assert.match(route, /if \(!account \|\| !hasAthleteAccess\(capabilities\)\) return null/);
  assert.match(route, /<WorkoutCalendarScreen key=\{account.id\}/);
  assert.match(
    read('../src/screens/workouts/ui/workouts-screen.tsx'),
    /router.push\('\/workouts\/calendar'\)/,
  );
});

test('authenticated appearance and language controls live only in app settings', () => {
  const profile = read('../src/screens/profile/ui/profile-screen.tsx');
  const settings = read('../src/screens/profile/ui/app-settings-screen.tsx');
  for (const component of ['ThemePicker', 'AccountLocalePicker']) {
    assert.ok(!profile.includes(component));
    assert.ok(settings.includes(`<${component} />`));
  }
});
