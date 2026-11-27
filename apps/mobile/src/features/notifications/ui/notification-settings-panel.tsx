import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useIntl } from 'react-intl';
import { createThemedStyles, useMobileTheme } from '@/shared/config/theme-provider';
import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { AsyncResourceState } from '@/shared/ui/async-resource-state';
import { useDevicePermission, useNotificationSettings } from '../model/use-notification-settings';
import { formatMinute, parseMinute } from '../model/settings-time';
import type { NotificationSettings, SettingsPatch } from '../services/settings-api';
import type { ReadDevicePermission } from '../lib/notification-policy';
import { REMINDER_QA_ENABLED } from '../lib/reminder-qa-mode';

type Change = (body: SettingsPatch) => Promise<void>;
function consentPatch(
  pair: NotificationSettings['preferences'][number],
  enabled: boolean,
): NonNullable<SettingsPatch['preferences']>[number] {
  if (pair.channel === 'MOBILE_PUSH')
    return { category: pair.category, channel: pair.channel, enabled };
  if (pair.channel === 'LOCAL_REMINDER')
    return { category: 'WORKOUT', channel: pair.channel, enabled };
  return { category: 'ACCOUNT', channel: 'EMAIL', enabled };
}

function QuietTimes({
  data,
  disabled,
  change,
}: {
  data: NotificationSettings;
  disabled: boolean;
  change: Change;
}) {
  const styles = useStyles();
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: 'web.notificationSettings.' + key });
  const [start, setStart] = useState(formatMinute(data.quietStartMinute));
  const [end, setEnd] = useState(formatMinute(data.quietEndMinute));
  const a = parseMinute(start),
    b = parseMinute(end);
  const invalid = a === null || b === null || a === b;
  const dirty = a !== data.quietStartMinute || b !== data.quietEndMinute;
  const off = disabled || invalid || !dirty;
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{t('quietTimes')} (HH:MM)</Text>
      <View style={styles.row}>
        <View style={styles.description}>
          <Text style={styles.hint}>{t('start')}</Text>
          <TextInput
            testID="notification-quiet-start"
            accessibilityLabel={t('start')}
            editable={!disabled}
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={5}
            value={start}
            onChangeText={setStart}
            style={styles.input}
          />
        </View>
        <View style={styles.description}>
          <Text style={styles.hint}>{t('end')}</Text>
          <TextInput
            testID="notification-quiet-end"
            accessibilityLabel={t('end')}
            editable={!disabled}
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={5}
            value={end}
            onChangeText={setEnd}
            style={styles.input}
          />
        </View>
      </View>
      {invalid ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('invalidTime')}
        </Text>
      ) : a > b ? (
        <Text style={styles.hint}>{t('overnight')}</Text>
      ) : null}
      {dirty && !invalid ? <Text style={styles.hint}>{t('unsaved')}</Text> : null}
      <Pressable
        testID="notification-save-times"
        accessibilityRole="button"
        accessibilityState={{ disabled: off }}
        disabled={off}
        style={[styles.button, off && styles.disabled]}
        onPress={() => {
          if (!off && a !== null && b !== null)
            void change({ quietStartMinute: a, quietEndMinute: b });
        }}
      >
        <Text style={styles.label}>{t('saveTimes')}</Text>
      </Pressable>
    </View>
  );
}

export function NotificationSettingsPanel({
  readPermission,
}: {
  readPermission?: ReadDevicePermission;
}) {
  const { account, capabilities } = useAuth();
  if (!account || !hasAthleteAccess(capabilities)) return null;
  return <SettingsContent key={account.id} readPermission={readPermission} />;
}

function SettingsContent({ readPermission }: { readPermission?: ReadDevicePermission }) {
  const styles = useStyles();
  const { palette } = useMobileTheme();
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string>) =>
    intl.formatMessage({ id: 'web.notificationSettings.' + key }, values);
  const local = (key: string) => intl.formatMessage({ id: 'mobile.notificationSettings.' + key });
  const { data, disabled, connected, foreground, query, mutation, denied, change, reload } =
    useNotificationSettings();
  const {
    status: permission,
    canRequest,
    requesting,
    request,
  } = useDevicePermission(readPermission);
  const reminderConsent = data?.preferences.some(
    (pair) => pair.category === 'WORKOUT' && pair.channel === 'LOCAL_REMINDER' && pair.enabled,
  );
  const error = mutation.error ?? query.error;
  const toggle = (
    label: string,
    value: boolean,
    onChange: (value: boolean) => void,
    testID: string,
  ) => (
    <Switch
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: disabled || requesting }}
      value={value}
      disabled={disabled || requesting}
      onValueChange={(value) => {
        if (!requesting) onChange(value);
      }}
      trackColor={{ false: palette.border, true: palette.primary }}
    />
  );
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('title')}
      </Text>
      <View style={styles.card}>
        <Text style={styles.hint}>{t('description')}</Text>
        <Text style={styles.label}>{local('permissionTitle')}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.label}>
          {local(permission)}
        </Text>
        {REMINDER_QA_ENABLED ? (
          <Text
            testID="notification-reminder-qa-mode"
            accessibilityRole="alert"
            style={styles.hint}
          >
            {local('qaMode')}
          </Text>
        ) : null}
        <Text style={styles.hint}>
          {local(REMINDER_QA_ENABLED ? 'qaPermissionHint' : 'permissionHint')}
        </Text>
        {permission === 'denied' ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {local('deniedHint')}
          </Text>
        ) : null}
        {permission === 'unavailable' ? (
          <Text style={styles.hint}>{local('unavailableHint')}</Text>
        ) : null}
        {reminderConsent && !readPermission && (canRequest || requesting) ? (
          <Pressable
            testID="notification-request-permission"
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || requesting }}
            disabled={disabled || requesting}
            style={[styles.button, (disabled || requesting) && styles.disabled]}
            onPress={() => void request(local('reminderChannel'))}
          >
            <Text style={styles.label}>
              {local(requesting ? 'requestingPermission' : 'requestPermission')}
            </Text>
          </Pressable>
        ) : null}
        {data ? (
          <>
            <Text accessibilityRole="header" style={styles.label}>
              {t('channels')}
            </Text>
            <Text style={styles.hint}>
              {REMINDER_QA_ENABLED ? local('qaConsentHint') : t('consentHint')}
            </Text>
            {data.preferences.map((pair) => (
              <View key={pair.category} style={styles.row}>
                <View style={styles.description}>
                  <Text style={styles.label}>{t(pair.category)}</Text>
                  <Text style={styles.hint}>{t(pair.channel)}</Text>
                </View>
                {toggle(
                  t(pair.category) + ' — ' + t(pair.channel),
                  pair.enabled,
                  (value) => void change({ preferences: [consentPatch(pair, value)] }),
                  'notification-consent-' + pair.category,
                )}
              </View>
            ))}
            <Text accessibilityRole="header" style={styles.label}>
              {t('quietHours')}
            </Text>
            <View style={styles.row}>
              <Text style={[styles.label, styles.description]}>{t('quietEnabled')}</Text>
              {toggle(
                t('quietEnabled'),
                data.quietHoursEnabled,
                (value) => void change({ quietHoursEnabled: value }),
                'notification-quiet-enabled',
              )}
            </View>
            <Text style={styles.hint}>
              {t('timezone', { zone: data.timezone ?? t('invalidZone') })}
            </Text>
            {data.timezone === null ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {t('timezoneWarning')}
              </Text>
            ) : null}
            <QuietTimes
              key={data.quietStartMinute + ':' + data.quietEndMinute}
              data={data}
              disabled={disabled || requesting}
              change={change}
            />
            <Text accessibilityRole="header" style={styles.label}>
              {t('reminder')}
            </Text>
            <View style={styles.presets}>
              {([15, 60, 1440] as const).map((minutes) => (
                <Pressable
                  key={minutes}
                  testID={'notification-lead-' + minutes}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: data.reminderLeadMinutes === minutes,
                    disabled: disabled || requesting,
                  }}
                  disabled={disabled || requesting}
                  style={[
                    styles.button,
                    data.reminderLeadMinutes === minutes && styles.selected,
                    (disabled || requesting) && styles.disabled,
                  ]}
                  onPress={() => {
                    if (!requesting && data.reminderLeadMinutes !== minutes)
                      void change({ reminderLeadMinutes: minutes });
                  }}
                >
                  <Text style={styles.label}>{t('lead' + minutes)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        <Text style={styles.hint}>{t('securityException')}</Text>
        {!connected ? (
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            {t('offline')}
          </Text>
        ) : null}
        {foreground &&
        connected &&
        (query.isFetching ||
          mutation.isPending ||
          (!data && query.isPending && !error && !denied)) ? (
          <AsyncResourceState
            kind="loading"
            message={t(mutation.isPending ? 'saving' : 'loading')}
          />
        ) : null}
        {error || denied ? (
          <AsyncResourceState
            kind="error"
            message={t(denied ? 'sessionError' : mutation.isError ? 'saveError' : 'loadError')}
            retryLabel={t('retry')}
            onRetry={connected && foreground ? () => void reload() : undefined}
            retrying={mutation.isPending || query.isFetching}
          />
        ) : null}
        {mutation.isSuccess && data && !query.isFetching ? (
          <Text accessibilityLiveRegion="polite" style={styles.label}>
            {t('saved')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    group: { gap: 12 },
    heading: { fontSize: 20, fontWeight: '700', color: palette.text },
    card: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      gap: 14,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    description: { flex: 1, gap: 6 },
    label: { fontSize: 16, fontWeight: '600', color: palette.text },
    hint: { fontSize: 14, color: palette.muted },
    error: { fontSize: 14, color: palette.error },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: palette.border,
      color: palette.text,
      padding: 12,
      borderRadius: 12,
      fontSize: 16,
    },
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    button: {
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      paddingHorizontal: 14,
    },
    selected: { borderColor: palette.primary, borderWidth: 2 },
    disabled: { opacity: 0.55 },
  }),
);
