import { useIntl } from 'react-intl';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/shared/config/theme';
import { useLocaleSelection } from './locale-provider';

export function LocalePicker() {
  const { locale, setLocale } = useLocaleSelection();
  const intl = useIntl();
  return (
    <View
      style={styles.row}
      accessibilityLabel={intl.formatMessage({ id: 'mobile.profile.language' })}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: locale === 'uk' }}
        onPress={() => setLocale('uk')}
        style={styles.button}
      >
        <Text style={styles.label}>Українська</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: locale === 'en' }}
        onPress={() => setLocale('en')}
        style={styles.button}
      >
        <Text style={styles.label}>English</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  button: { borderRadius: 12, borderWidth: 1, borderColor: palette.border, padding: 12 },
  label: { color: palette.text },
});
