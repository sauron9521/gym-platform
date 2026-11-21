export const THEME_COOKIE_NAME = 'ovranto-theme';
export const THEME_COOKIE_MAX_AGE_SECONDS = 31_536_000;

export type ThemePreference = 'system' | 'light' | 'dark';

/** Invalid/legacy cookies never force an unexpected theme on the user. */
export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
