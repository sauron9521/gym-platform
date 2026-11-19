import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { parseThemePreference, THEME_COOKIE_NAME } from '@/shared/lib/theme-preference';
import { ThemeSwitcher } from '@/shared/ui/theme-switcher';

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('light', 'dark');
  document.cookie = `${THEME_COOKIE_NAME}=; Path=/; Max-Age=0`;
});

test('unknown theme cookies resolve safely to system preference', () => {
  expect(parseThemePreference(undefined)).toBe('system');
  expect(parseThemePreference('garbage')).toBe('system');
  expect(parseThemePreference('system')).toBe('system');
  expect(parseThemePreference('light')).toBe('light');
  expect(parseThemePreference('dark')).toBe('dark');
});

test('theme choices persist as host-only cookies and update HTML class', () => {
  render(<ThemeSwitcher initialPreference="system" locale="uk" />);
  const select = screen.getByRole('combobox', { name: 'Тема інтерфейсу' });
  expect(select.getAttribute('value')).toBeNull();

  fireEvent.change(select, { target: { value: 'dark' } });
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=dark`);

  fireEvent.change(select, { target: { value: 'light' } });
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(document.documentElement.classList.contains('light')).toBe(true);
  expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=light`);

  fireEvent.change(select, { target: { value: 'system' } });
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(document.documentElement.classList.contains('light')).toBe(false);
  expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=system`);
});

test('the selector has accessible English labels and the persisted initial value', () => {
  render(<ThemeSwitcher initialPreference="dark" locale="en" />);
  const select = screen.getByRole('combobox', { name: 'Appearance theme' });
  expect((select as HTMLSelectElement).value).toBe('dark');
  expect(screen.getByRole('option', { name: 'System' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Light' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Dark' })).toBeTruthy();
});
