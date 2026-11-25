import { ovrantoNativePalette, type OvrantoTheme } from '@gym/design-tokens/ovranto-native';

export type ThemePreference = OvrantoTheme | 'system';
export const themePreferences = ['system', 'light', 'dark'] as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return themePreferences.some((preference) => preference === value);
}

export function resolveMobileTheme(
  preference: ThemePreference,
  system: string | null | undefined,
): OvrantoTheme {
  return preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
}

export function mobilePalette(mode: OvrantoTheme) {
  const tokens = ovrantoNativePalette[mode];
  return {
    background: tokens.background,
    surface: tokens.card,
    text: tokens.foreground,
    muted: tokens.mutedForeground,
    primary: tokens.primary,
    primaryForeground: tokens.primaryForeground,
    border: tokens.border,
    error: tokens.destructive,
    errorForeground: tokens.destructiveForeground,
    success: tokens.success,
    setCompleteBackground: tokens.setCompleteBackground,
    setCompleteForeground: tokens.setCompleteForeground,
  };
}

export type MobilePalette = ReturnType<typeof mobilePalette>;
export const mobilePalettes = { light: mobilePalette('light'), dark: mobilePalette('dark') };
