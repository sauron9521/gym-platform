import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import {
  parseThemePreference,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_COOKIE_NAME,
} from '../../src/shared/lib/theme-preference';
import { ThemeSwitcher } from '../../src/shared/ui/theme-switcher';

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('light', 'dark');
  document.cookie = THEME_COOKIE_NAME + '=; Path=/; Max-Age=0';
});

test('unknown or legacy cookies never force an unexpected theme', () => {
  for (const candidate of [undefined, null, '', 'automatic', 'BLACK', 'bad']) {
    expect(parseThemePreference(candidate)).toBe('system');
  }
  for (const value of ['light', 'dark', 'system'] as const) {
    expect(parseThemePreference(value)).toBe(value);
  }
  expect(THEME_COOKIE_MAX_AGE_SECONDS).toBe(31_536_000);
});

test('choice persists to same-site, host-only cookie and updates root without reload', () => {
  render(<ThemeSwitcher initialPreference="system" locale="uk" />);
  const selector = screen.getByRole('combobox', { name: 'Тема інтерфейсу' });
  expect((selector as HTMLSelectElement).value).toBe('system');

  fireEvent.change(selector, { target: { value: 'dark' } });
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(document.cookie).toContain(THEME_COOKIE_NAME + '=dark');

  fireEvent.change(selector, { target: { value: 'light' } });
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(document.documentElement.classList.contains('light')).toBe(true);
  expect(document.cookie).toContain(THEME_COOKIE_NAME + '=light');

  fireEvent.change(selector, { target: { value: 'system' } });
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(document.documentElement.classList.contains('light')).toBe(false);
  expect(document.cookie).toContain(THEME_COOKIE_NAME + '=system');
});

test('English selector has localized accessible options and persisted initial value', () => {
  render(<ThemeSwitcher initialPreference="dark" locale="en" />);
  const selector = screen.getByRole('combobox', { name: 'Appearance theme' });
  expect((selector as HTMLSelectElement).value).toBe('dark');
  for (const option of ['System', 'Light', 'Dark']) {
    expect(screen.getByRole('option', { name: option })).toBeTruthy();
  }
});
