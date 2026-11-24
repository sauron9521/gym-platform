import { isWorkoutOutsideDuration } from '../domain/duration.policy.js';

describe('isWorkoutOutsideDuration', () => {
  it.each([
    [1, 4, false],
    [4, 4, false],
    [5, 4, true],
    [100, null, false],
    [100, undefined, false],
  ] as const)('checks week %s against duration %s', (week, duration, expected) => {
    expect(isWorkoutOutsideDuration(week, duration)).toBe(expected);
  });
});
