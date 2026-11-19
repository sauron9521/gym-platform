import { describe, expect, it } from 'vitest';

import { resolveRequestLocale } from '@gym/i18n';

import { getTrainerApiOrigin } from '../src/shared/api/upstream.mjs';
import { trainerCopy } from '../src/shared/i18n/copy';
import { parseThemePreference } from '../src/shared/lib/theme-preference';

describe('Trainer bootstrap boundaries', () => {
  it('has matching uk/en copy for scaffold states and accessible navigation', () => {
    expect(Object.keys(trainerCopy.uk).sort()).toEqual(Object.keys(trainerCopy.en).sort());
    expect(trainerCopy.uk.pageTitle).not.toBe(trainerCopy.en.pageTitle);
  });

  it('resolves locale without trusting unsupported cookie values', () => {
    expect(resolveRequestLocale('en', 'uk-UA')).toBe('en');
    expect(resolveRequestLocale('not-valid', 'en-GB,en;q=0.8')).toBe('en');
    expect(resolveRequestLocale(undefined, null)).toBe('uk');
  });

  it('defaults to system theme and accepts only explicit modes', () => {
    expect(parseThemePreference(undefined)).toBe('system');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('invalid')).toBe('system');
  });

  it('rejects unsafe upstream URLs while accepting fixed origins', () => {
    expect(getTrainerApiOrigin('http://127.0.0.1:3001')).toBe('http://127.0.0.1:3001');
    expect(() => getTrainerApiOrigin('https://u:p@example.org')).toThrow();
    expect(() => getTrainerApiOrigin('https://example.org/private')).toThrow();
    expect(() => getTrainerApiOrigin('file:///tmp/api')).toThrow();
    expect(() => getTrainerApiOrigin('https://example.org?redirect=1')).toThrow();
  });
});
