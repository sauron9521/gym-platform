/**
 * sRGB equivalents of the canonical Dark Performance OKLCH CSS palette.
 * React Native StyleSheet cannot evaluate CSS OKLCH variables.
 * Keep these values aligned with src/dark.css (and Mobile's UniWind dark layer).
 */
export const nativePalette = {
  background: '#0a0e13',
  surface: '#14191f',
  text: '#eff2f6',
  muted: '#acb2b9',
  primary: '#b6ea3a',
  border: '#323941',
} as const;
