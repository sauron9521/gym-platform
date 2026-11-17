import { describe, expect, it } from 'vitest';
import { formatRestTime, secondsRemaining } from '../src/features/workouts/lib/rest-timer.ts';

describe('rest timer', () => {
  it('renders absolute countdown time safely', () => {
    expect(formatRestTime(90)).toBe('01:30');
    expect(formatRestTime(-1)).toBe('00:00');
    expect(formatRestTime(Number.NaN)).toBe('00:00');
    expect(formatRestTime(3600)).toBe('60:00');
  });
  it('uses a deadline, not accumulated interval ticks', () => {
    expect(secondsRemaining(10000, 8500)).toBe(2);
    expect(secondsRemaining(10000, 10100)).toBe(0);
  });
});
