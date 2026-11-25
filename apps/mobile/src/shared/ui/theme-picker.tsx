import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIntl } from 'react-intl';
import { themePreferences } from '@/shared/config/theme';
import { createThemedStyles, useMobileTheme } from '@/shared/config/theme-provider';

export function ThemePicker() {
  const { preference, setPreference } = useMobileTheme();
  const styles = useStyles();
  const intl = useIntl();
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{intl.formatMessage({ id: 'mobile.theme.title' })}</Text>
      <View style={styles.row}>
        {themePreferences.map((choice) => (
          <Pressable
            key={choice}
            testID={`theme-${choice}`}
            accessibilityRole="button"
            accessibilityState={{ selected: preference === choice }}
            onPress={() => setPreference(choice)}
            style={[styles.choice, preference === choice && styles.selected]}
          >
            <Text style={[styles.label, preference === choice && styles.selectedLabel]}>
              {intl.formatMessage({ id: `mobile.theme.${choice}` })}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: { gap: 8 },
    label: { color: palette.text, fontWeight: '600' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: {
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    selected: { backgroundColor: palette.primary, borderColor: palette.primary },
    selectedLabel: { color: palette.primaryForeground },
  }),
);
