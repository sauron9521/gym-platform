import { ovrantoNativePalette } from '@gym/design-tokens/ovranto-native';

/**
 * OVRANTO Design System v2 — native dark semantic palette.
 * Existing Mobile screens use the same theme adapter; never copy hex values here.
 * Light-mode switching is a separate UI/runtime migration.
 */
const dark = ovrantoNativePalette.dark;

export const palette = {
  background: dark.background,
  surface: dark.card,
  text: dark.foreground,
  muted: dark.mutedForeground,
  primary: dark.primary,
  primaryForeground: dark.primaryForeground,
  border: dark.border,
  error: dark.destructive,
} as const;
