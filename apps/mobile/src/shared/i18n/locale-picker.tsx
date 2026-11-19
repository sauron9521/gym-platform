import { useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/model/auth-context';
import { palette } from '@/shared/config/theme';
import { useLocaleSelection } from './locale-provider';

export function LocalePicker() {
  const { locale, setLocale } = useLocaleSelection();
  const { account, getApi } = useAuth();
  const intl = useIntl();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const requestInFlight = useRef(false);

  async function select(next: 'uk' | 'en') {
    if (next === locale || pending || requestInFlight.current) return;
    requestInFlight.current = true;
    setPending(true);
    setError(false);
    try {
      if (account) {
        const api = getApi();
        if (!api) throw new Error('API unavailable');
        const response = await api.PATCH('/users/me/preferences', {
          body: { preferredLocale: next },
        });
        if (response.response.status !== 200 || response.data?.preferredLocale !== next) {
          throw new Error('Locale preference not confirmed');
        }
      }
      setLocale(next);
    } catch {
      setError(true);
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  }
  return (
    <View>
      <View
        style={styles.row}
        accessibilityLabel={intl.formatMessage({ id: 'mobile.profile.language' })}
      >
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          accessibilityState={{ selected: locale === 'uk', disabled: pending }}
          onPress={() => void select('uk')}
          style={styles.button}
        >
          <Text style={styles.label}>Українська</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          accessibilityState={{ selected: locale === 'en', disabled: pending }}
          onPress={() => void select('en')}
          style={styles.button}
        >
          <Text style={styles.label}>English</Text>
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.label}>
          {intl.formatMessage({ id: 'common.languageUpdateError' })}
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
