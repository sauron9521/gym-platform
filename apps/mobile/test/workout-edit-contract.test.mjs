import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { workoutTitleError } from '../src/features/workouts/lib/workout-edit-policy.ts';

const model = readFileSync(
  new URL('../src/features/workouts/model/workout-edit.ts', import.meta.url),
  'utf8',
);
const screen = readFileSync(
  new URL('../src/screens/workouts/ui/workout-details-screen.tsx', import.meta.url),
  'utf8',
);

describe('workout title edit and cancellation', () => {
  it('accepts only trimmed titles with 2–120 characters', () => {
    expect(workoutTitleError(' A ')).not.toBeNull();
    expect(workoutTitleError('  Плечі  ')).toBeNull();
    expect(workoutTitleError('x'.repeat(120))).toBeNull();
    expect(workoutTitleError('x'.repeat(121))).not.toBeNull();
  });

  it('uses typed PATCH/cancel endpoints with online gate and no automatic retry', () => {
    expect(model).toContain("api.PATCH('/workouts/{id}'");
    expect(model).toContain("api.POST('/workouts/{id}/cancel'");
    expect(model).toContain("networkMode: 'always'");
    expect(model).toContain('retry: false');
    expect(model).toContain('onlineManager.isOnline()');
  });

  it('guards private caches against logout and older detail GETs', () => {
    expect(model).toContain('accountQueryKeys.me(account.id)');
    expect(model).toContain('queryClient.cancelQueries({ queryKey: detailKey })');
    expect(model).toContain('accountQueryKeys.workouts(account.id)');
  });

  it('confirms destructive cancellation and only edits planned workouts', () => {
    expect(screen).toContain('Alert.alert(');
    expect(screen).toContain('confirmCancellation');
    expect(screen).toContain("workout.status === 'PLANNED'");
    expect(screen).toContain('RestTimer key={id}');
  });
});
