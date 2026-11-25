import { StyleSheet } from 'react-native';
import { createThemedStyles } from '@/shared/config/theme-provider';

export const useWorkoutFormStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    label: { fontSize: 14, fontWeight: '600', color: palette.text },
    text: { color: palette.text, fontWeight: '600' },
    error: { color: palette.error, fontSize: 14 },
    input: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      paddingHorizontal: 14,
      color: palette.text,
    },
    group: { gap: 12, padding: 14, borderColor: palette.border, borderWidth: 1, borderRadius: 12 },
    set: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: palette.surface },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    secondary: {
      padding: 14,
      borderRadius: 12,
      borderColor: palette.border,
      borderWidth: 1,
      minHeight: 44,
    },
  }),
);
