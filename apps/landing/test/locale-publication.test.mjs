import { afterEach, describe, expect, test } from 'vitest';
import { requirePublishedLocale } from '../src/i18n/route-guard.ts';
import { routing } from '../src/i18n/routing.ts';
import { getMessages } from '@gym/i18n';

const originalFlag = process.env.LANDING_ENABLE_I18N_ROUTES;

afterEach(() => {
  if (originalFlag === undefined) delete process.env.LANDING_ENABLE_I18N_ROUTES;
  else process.env.LANDING_ENABLE_I18N_ROUTES = originalFlag;
});

describe('Landing route publication gate', () => {
  test.each([undefined, 'false', 'TRUE', '1', ''])(
    'hides all prefixed routes without explicit true flag (%s)',
    (value) => {
      if (value === undefined) delete process.env.LANDING_ENABLE_I18N_ROUTES;
      else process.env.LANDING_ENABLE_I18N_ROUTES = value;
      expect(() => requirePublishedLocale('uk', true)).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
      expect(() => requirePublishedLocale('en', true)).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    },
  );

  test('permits the translated home page in Ukrainian and English only when enabled', () => {
    process.env.LANDING_ENABLE_I18N_ROUTES = 'true';
    expect(requirePublishedLocale('uk', true)).toBe('uk');
    expect(requirePublishedLocale('en', true)).toBe('en');
  });

  test('permits untranslated secondary pages in Ukrainian but not English', () => {
    process.env.LANDING_ENABLE_I18N_ROUTES = 'true';
    expect(requirePublishedLocale('uk', false)).toBe('uk');
    expect(() => requirePublishedLocale('en', false)).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  test.each(['fr', 'de', 'EN', 'uk-UA', '', '../en', 'en/about', 'null'])(
    'never publishes unsupported or malformed locale %s',
    (locale) => {
      process.env.LANDING_ENABLE_I18N_ROUTES = 'true';
      expect(() => requirePublishedLocale(locale, true)).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
      expect(() => requirePublishedLocale(locale, false)).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    },
  );

  test('routing uses exactly supported locales and always prefixes when enabled', () => {
    expect(routing.locales).toEqual(['uk', 'en']);
    expect(routing.defaultLocale).toBe('uk');
    expect(routing.localePrefix).toBe('always');
  });

  test('skip-to-content accessibility label is translated in both catalogs', () => {
    expect(getMessages('uk').landing.shell.skipToContent).toBe('Перейти до вмісту');
    expect(getMessages('en').landing.shell.skipToContent).toBe('Skip to content');
  });
});
