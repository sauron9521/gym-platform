import { describe, expect, it } from 'vitest';
import { classifyHttpFailure, parseRetryAfterSeconds } from '../src/errors';

describe('stable API failure categories', () => {
  it.each([
    [null, 'network'],
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [409, 'conflict'],
    [400, 'validation'],
    [422, 'validation'],
    [429, 'throttled'],
    [500, 'server'],
    [503, 'server'],
    [418, 'unknown'],
    [204, 'unknown'],
    [599, 'server'],
    [600, 'unknown'],
    [0, 'unknown'],
    [-1, 'unknown'],
    [NaN, 'unknown'],
    [Infinity, 'unknown'],
    [429.5, 'unknown'],
  ])('maps %s to %s without leaking a server message', (status, kind) => {
    expect(classifyHttpFailure(status)).toBe(kind);
  });
});

describe('Retry-After', () => {
  it('reads seconds and caps extreme delays', () => {
    expect(parseRetryAfterSeconds('45')).toBe(45);
    expect(parseRetryAfterSeconds('0')).toBe(0);
    expect(parseRetryAfterSeconds(' 15 ')).toBe(15);
    expect(parseRetryAfterSeconds('9999999')).toBe(86_400);
    expect(parseRetryAfterSeconds('10000000000000000000000000')).toBe(null);
  });

  it('reads HTTP dates with a caller-supplied clock', () => {
    const now = Date.parse('2026-11-18T00:00:00.000Z');
    expect(parseRetryAfterSeconds('Wed, 18 Nov 2026 00:00:35 GMT', now)).toBe(35);
    expect(parseRetryAfterSeconds('Tue, 17 Nov 2026 00:00:35 GMT', now)).toBe(null);
    expect(parseRetryAfterSeconds('Thu, 19 Nov 2026 00:00:00 GMT', now)).toBe(86_400);
    expect(parseRetryAfterSeconds('Wed, 18 Nov 2026 00:00:01 GMT', now + 100)).toBe(1);
  });

  it('ignores absent, malformed and negative delays', () => {
    expect(parseRetryAfterSeconds(null)).toBe(null);
    expect(parseRetryAfterSeconds('-10')).toBe(null);
    expect(parseRetryAfterSeconds('not a date')).toBe(null);
    expect(parseRetryAfterSeconds('1.5')).toBe(null);
    expect(parseRetryAfterSeconds('1e3')).toBe(null);
    expect(parseRetryAfterSeconds('+5')).toBe(null);
    expect(parseRetryAfterSeconds('2026-11-18T00:00:35Z')).toBe(null);
    expect(
      parseRetryAfterSeconds('Tue, 18 Nov 2026 00:00:35 GMT', Date.parse('2026-11-18T00:00:00Z')),
    ).toBe(null);
    expect(
      parseRetryAfterSeconds('Wed, 31 Nov 2026 00:00:35 GMT', Date.parse('2026-11-18T00:00:00Z')),
    ).toBe(null);
    expect(parseRetryAfterSeconds('Wed, 18 Nov 2026 00:00:35 UTC')).toBe(null);
    expect(parseRetryAfterSeconds('x'.repeat(129))).toBe(null);
    expect(parseRetryAfterSeconds('Wed, 18 Nov 2026 00:00:35 GMT', NaN)).toBe(null);
  });
});
