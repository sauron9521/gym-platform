import { describe, expect, it } from 'vitest';

import { resolveRequestLocale } from '../src/i18n/resolve-request-locale';

describe('Admin request locale selection', () => {
  it('defaults to Ukrainian for missing or unsupported languages', () => {
    expect(resolveRequestLocale(undefined, null)).toBe('uk');
    expect(resolveRequestLocale(undefined, 'fr-FR, de;q=0.9')).toBe('uk');
  });

  it('prioritizes an explicit valid cookie over browser preferences', () => {
    expect(resolveRequestLocale('en', 'uk-UA, en-US;q=0.9')).toBe('en');
    expect(resolveRequestLocale('uk', 'en-US')).toBe('uk');
  });

  it('ignores invalid cookies and selects the highest-ranked supported browser language', () => {
    expect(resolveRequestLocale('fr', 'fr-FR, en-US;q=0.9, uk;q=0.8')).toBe('en');
    expect(resolveRequestLocale(undefined, 'fr;q=0.2, uk;q=0.5, en;q=0.9')).toBe('en');
  });

  it('rejects zero and malformed quality weights', () => {
    expect(resolveRequestLocale(undefined, 'en;q=0,uk;q=0.6')).toBe('uk');
    expect(resolveRequestLocale(undefined, 'en;q=invalid,uk;q=0.8')).toBe('uk');
  });
});
