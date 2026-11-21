import type { Locale } from '@gym/i18n';
import { useIntl } from 'react-intl';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/shared/config/theme';
import { useLocaleSelection } from './locale-provider';

type Props = {
  disabled?: boolean;
  error?: string | null;
  onSelect?: (locale: Locale) => void;
};

/** Reusable UI: guests update local preference; authenticated persistence is injected by a feature. */
export function LocalePicker({ disabled = false, error, onSelect }: Props) {
  const { locale, setLocale } = useLocaleSelection();
  const intl = useIntl();

  const choose = (next: Locale) => {
    if (disabled || next === locale) return;
    if (onSelect) onSelect(next);
    else setLocale(next);
  };

  return (
    <View>
      <View
        style={styles.row}
        accessibilityLabel={intl.formatMessage({ id: 'mobile.profile.language' })}
      >
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          accessibilityState={{ selected: locale === 'uk', disabled }}
          onPress={() => choose('uk')}
          style={styles.button}
        >
          <Text style={styles.label}>Українська</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          accessibilityState={{ selected: locale === 'en', disabled }}
          onPress={() => choose('en')}
          style={styles.button}
        >
          <Text style={styles.label}>English</Text>
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.label}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  button: { borderRadius: 12, borderWidth: 1, borderColor: palette.border, padding: 12 },
  label: { color: palette.text },
});
