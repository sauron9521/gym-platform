import { describe, expect, it } from 'vitest';

import { resolveRequestLocale } from '../src/i18n/resolve-request-locale';

describe('Web request locale selection', () => {
  it('uses Ukrainian when neither a visitor preference nor a supported browser language exists', () => {
    expect(resolveRequestLocale(undefined, null)).toBe('uk');
    expect(resolveRequestLocale(undefined, 'fr-FR, de;q=0.9')).toBe('uk');
  });

  it('honors explicit valid cookie over browser language', () => {
    expect(resolveRequestLocale('en', 'uk-UA, en-US;q=0.9')).toBe('en');
    expect(resolveRequestLocale('uk', 'en-US')).toBe('uk');
  });

  it('ignores an invalid cookie and picks the best supported language', () => {
    expect(resolveRequestLocale('fr', 'fr-FR, en-US;q=0.9, uk;q=0.8')).toBe('en');
    expect(resolveRequestLocale(undefined, 'en-US,en;q=0.8,uk;q=0.7')).toBe('en');
    expect(resolveRequestLocale(undefined, 'fr;q=0.1, en;q=0.9, uk;q=0.5')).toBe('en');
  });

  it('ignores languages with a zero or invalid quality value', () => {
    expect(resolveRequestLocale(undefined, 'en;q=0,uk;q=0.6')).toBe('uk');
    expect(resolveRequestLocale(undefined, 'en;q=invalid,uk;q=0.8')).toBe('uk');
  });

  it('supports case-insensitive regional tags, tied weights, and rejects out-of-range weights', () => {
    expect(resolveRequestLocale(undefined, 'fr;q=0.9, EN-us;q=0.8, uk;q=0.7')).toBe('en');
    expect(resolveRequestLocale(undefined, 'uk;q=0.8,en;q=0.8')).toBe('uk');
    expect(resolveRequestLocale(undefined, 'en;q=1.5,uk;q=0.4')).toBe('uk');
  });
});
