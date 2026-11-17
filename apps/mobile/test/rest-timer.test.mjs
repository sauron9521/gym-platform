import { describe, expect, it } from 'vitest';

import {
  formatRestTime,
  secondsRemaining,
} from '../src/features/workouts/lib/rest-timer.ts';

describe('rest timer deadline math', () => {
  it('formats valid values without producing negative or nonfinite text', () => {
    expect(formatRestTime(90)).toBe('01:30');
    expect(formatRestTime(5)).toBe('00:05');
    expect(formatRestTime(-1)).toBe('00:00');
    expect(formatRestTime(Number.NaN)).toBe('00:00');
    expect(formatRestTime(Number.POSITIVE_INFINITY)).toBe('00:00');
    expect(formatRestTime(3600)).toBe('60:00');
  });

  it('uses absolute elapsed wall time, including periods without interval ticks', () => {
    expect(secondsRemaining(10000, 8500)).toBe(2);
    expect(secondsRemaining(10000, 9999)).toBe(1);
    expect(secondsRemaining(10000, 10000)).toBe(0);
    expect(secondsRemaining(10000, 10100)).toBe(0);
    expect(secondsRemaining(10000, -1000)).toBe(11);
    expect(secondsRemaining(Number.NaN, 100)).toBe(0);
  });
});
