import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useIntl } from 'react-intl';

import { useAppSettings } from '@/features/app-settings/model/app-settings-context';
import { palette } from '@/shared/config/theme';

export function AppSettingsScreen() {
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: `mobile.settings.${key}` });
  const { settings, setAutoRestTimer, reload } = useAppSettings();
  const disabled = settings.status !== 'ready' && settings.status !== 'saveError';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t('workouts')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.description}>
            <Text style={styles.label}>{t('autoRestTimer')}</Text>
            <Text style={styles.hint}>{t('autoRestTimerHint')}</Text>
          </View>
          <Switch
            testID="settings-auto-rest-timer"
            accessibilityLabel={t('autoRestTimer')}
            disabled={disabled}
            value={settings.enabled}
            onValueChange={(value) => void setAutoRestTimer(value)}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </View>
        {settings.status === 'loading' || settings.status === 'saving' ? (
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            {t('pending')}
          </Text>
        ) : null}
        {settings.status === 'readError' || settings.status === 'saveError' ? (
          <Text accessibilityRole="alert" style={styles.label}>
            {t('storageError')}
          </Text>
        ) : null}
        {settings.status === 'readError' ? (
          <Pressable accessibilityRole="button" onPress={reload}>
            <Text style={styles.label}>{t('retry')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>{t('deviceOnly')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 16 },
  heading: { fontSize: 20, fontWeight: '700', color: palette.text },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  description: { flex: 1, gap: 6 },
  label: { fontSize: 16, fontWeight: '600', color: palette.text },
  hint: { fontSize: 14, color: palette.muted },
});
