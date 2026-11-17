import { test, expect } from 'vitest';

import {
  defaultLocale,
  getMessages,
  isSupportedLocale,
} from '../src/shared/i18n/dictionaries.ts';

test('Ukrainian default and English have matching translation keys', () => {
  expect(defaultLocale).toBe('uk');
  expect(isSupportedLocale('en')).toBe(true);
  expect(isSupportedLocale('fr')).toBe(false);
  const shape = (value) =>
    Object.fromEntries(
      Object.entries(value).map(([name, group]) => [name, Object.keys(group).sort()]),
    );
  expect(shape(getMessages('en'))).toEqual(shape(getMessages('uk')));
});
