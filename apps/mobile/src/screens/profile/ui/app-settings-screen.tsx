import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useIntl } from 'react-intl';

import { AccountLocalePicker } from '@/features/profile/ui/account-locale-picker';
import { ThemePicker } from '@/shared/ui/theme-picker';
import { useAppSettings } from '@/features/app-settings/model/app-settings-context';
import { restDurationPresets } from '@/shared/config/rest-duration';
import { createThemedStyles, useMobileTheme } from '@/shared/config/theme-provider';

export function AppSettingsScreen() {
  const styles = useStyles();
  const { palette } = useMobileTheme();
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: `mobile.settings.${key}` });
  const {
    settings,
    setAutoRestTimer,
    setRestDuration,
    setRestSound,
    setRestVibration,
    setKeepWorkoutScreenAwake,
    setShowPreviousSets,
    setAutoCollapseExercises,
    reload,
    retryAccount,
  } = useAppSettings((state) => state);
  const disabled = settings.status !== 'ready' && settings.status !== 'saveError';
  const accountDisabled = settings.accountStatus !== 'ready';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('workouts')}
      </Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.description}>
            <Text style={styles.label}>{t('autoRestTimer')}</Text>
            <Text style={styles.hint}>{t('autoRestTimerHint')}</Text>
          </View>
          <Switch
            testID="settings-auto-rest-timer"
            accessibilityLabel={t('autoRestTimer')}
            disabled={accountDisabled}
            value={settings.enabled}
            onValueChange={(value) => void setAutoRestTimer(value)}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </View>
        <View style={styles.description}>
          <Text style={styles.label}>{t('restDuration')}</Text>
          <Text style={styles.hint}>{t('restDurationHint')}</Text>
          <View style={styles.presets}>
            {restDurationPresets.map((seconds) => {
              const selected = settings.restDuration === seconds;
              return (
                <Pressable
                  key={seconds}
                  testID={`settings-rest-duration-${seconds}`}
                  accessibilityRole="button"
                  accessibilityLabel={intl.formatMessage(
                    { id: 'mobile.settings.seconds' },
                    { seconds },
                  )}
                  accessibilityState={{ selected, disabled: accountDisabled }}
                  disabled={accountDisabled}
                  onPress={() => {
                    if (!selected) void setRestDuration(seconds);
                  }}
                  style={[styles.preset, selected && styles.selected]}
                >
                  <Text style={[styles.label, selected && styles.selectedLabel]}>
                    {intl.formatMessage({ id: 'mobile.settings.seconds' }, { seconds })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Text style={styles.hint}>{t('workoutAccount')}</Text>
        {settings.accountStatus === 'loading' || settings.accountStatus === 'saving' ? (
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            {t('pending')}
          </Text>
        ) : null}
        {settings.accountStatus === 'offline' ? (
          <Text style={styles.hint}>{t('workoutOffline')}</Text>
        ) : null}
        {settings.accountStatus === 'error' ? (
          <>
            <Text accessibilityRole="alert" style={styles.label}>
              {t('workoutSyncError')}
            </Text>
            <Pressable accessibilityRole="button" onPress={retryAccount}>
              <Text style={styles.label}>{t('retry')}</Text>
            </Pressable>
          </>
        ) : null}
        {[
          { id: 'rest-sound', label: 'restSound', enabled: settings.restSound, save: setRestSound },
          {
            id: 'rest-vibration',
            label: 'restVibration',
            enabled: settings.restVibration,
            save: setRestVibration,
          },
        ].map((feedback) => (
          <View key={feedback.id} style={styles.row}>
            <View style={styles.description}>
              <Text style={styles.label}>{t(feedback.label)}</Text>
              <Text style={styles.hint}>{t('restFeedbackHint')}</Text>
            </View>
            <Switch
              testID={`settings-${feedback.id}`}
              accessibilityLabel={t(feedback.label)}
              disabled={disabled}
              value={feedback.enabled}
              onValueChange={(value) => void feedback.save(value)}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>
        ))}
        <View style={styles.row}>
          <View style={styles.description}>
            <Text style={styles.label}>{t('keepWorkoutScreenAwake')}</Text>
            <Text style={styles.hint}>{t('keepWorkoutScreenAwakeHint')}</Text>
          </View>
          <Switch
            testID="settings-keep-workout-screen-awake"
            accessibilityLabel={t('keepWorkoutScreenAwake')}
            disabled={disabled}
            value={settings.keepWorkoutScreenAwake}
            onValueChange={(value) => void setKeepWorkoutScreenAwake(value)}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.description}>
            <Text style={styles.label}>{t('showPreviousSets')}</Text>
            <Text style={styles.hint}>{t('showPreviousSetsHint')}</Text>
          </View>
          <Switch
            testID="settings-show-previous-sets"
            accessibilityLabel={t('showPreviousSets')}
            disabled={disabled}
            value={settings.showPreviousSets}
            onValueChange={(value) => void setShowPreviousSets(value)}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.description}>
            <Text style={styles.label}>{t('autoCollapseExercises')}</Text>
            <Text style={styles.hint}>{t('autoCollapseExercisesHint')}</Text>
          </View>
          <Switch
            testID="settings-auto-collapse-exercises"
            accessibilityLabel={t('autoCollapseExercises')}
            disabled={disabled}
            value={settings.autoCollapseExercises}
            onValueChange={(value) => void setAutoCollapseExercises(value)}
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
      <Text accessibilityRole="header" style={styles.heading}>
        {t('appearance')}
      </Text>
      <View style={styles.card}>
        <ThemePicker />
        <Text style={styles.hint}>{t('themeDeviceOnly')}</Text>
      </View>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('language')}
      </Text>
      <View style={styles.card}>
        <AccountLocalePicker />
        <Text style={styles.hint}>{t('languageAccount')}</Text>
      </View>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
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
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    preset: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    selected: { backgroundColor: palette.primary, borderColor: palette.primary },
    selectedLabel: { color: palette.primaryForeground },
  }),
);
