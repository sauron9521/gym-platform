'use client';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/button';
import { useNotificationSettings } from '../model/use-settings';
import { formatMinute, parseMinute } from '../model/settings-time';
import type { NotificationSettings, SettingsPatch } from '../api/settings';

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

type Change = (body: SettingsPatch) => Promise<void>;
const inputClass =
  'min-h-11 rounded-lg border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring';

function QuietTimes({
  data,
  disabled,
  change,
}: {
  data: NotificationSettings;
  disabled: boolean;
  change: Change;
}) {
  const t = useTranslations('web.notificationSettings');
  const [start, setStart] = useState(formatMinute(data.quietStartMinute));
  const [end, setEnd] = useState(formatMinute(data.quietEndMinute));
  const startMinute = parseMinute(start),
    endMinute = parseMinute(end);
  const invalid = startMinute === null || endMinute === null || startMinute === endMinute;
  const dirty = startMinute !== data.quietStartMinute || endMinute !== data.quietEndMinute;
  const errorId = useId();
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && dirty && !invalid)
          void change({ quietStartMinute: startMinute, quietEndMinute: endMinute });
      }}
    >
      <fieldset disabled={disabled} className="space-y-3 disabled:opacity-70">
        <legend className="sr-only">{t('quietTimes')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('start')}
            <input
              type="time"
              required
              className={inputClass}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('end')}
            <input
              type="time"
              required
              className={inputClass}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
            />
          </label>
        </div>
        {invalid ? (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {t('invalidTime')}
          </p>
        ) : startMinute > endMinute ? (
          <p className="text-sm text-muted-foreground">{t('overnight')}</p>
        ) : null}
        {dirty && !invalid && <p className="text-sm text-muted-foreground">{t('unsaved')}</p>}
        <Button type="submit" variant="outline" disabled={!dirty || invalid || disabled}>
          {t('saveTimes')}
        </Button>
      </fieldset>
    </form>
  );
}
export function NotificationSettingsPanel({ accountId }: { accountId: string }) {
  const t = useTranslations('web.notificationSettings');
  const { data, disabled, connected, shown, query, mutation, denied, change, reload } =
    useNotificationSettings(accountId);
  const error = mutation.error ?? query.error;
  const hintId = useId();
  return (
    <section
      aria-labelledby="notification-settings-heading"
      className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6"
    >
      <header className="space-y-2">
        <h2 id="notification-settings-heading" className="text-xl font-semibold">
          {t('title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </header>
      {data && (
        <>
          <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
            <legend className="font-semibold">{t('channels')}</legend>
            <p id={hintId} className="text-sm text-muted-foreground">
              {t('consentHint')}
            </p>
            {data.preferences.map((pair) => (
              <label
                key={pair.category}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border-b pb-3"
              >
                <span>
                  <span className="block font-medium">{t(pair.category)}</span>
                  <span className="block text-sm text-muted-foreground">{t(pair.channel)}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={t(pair.category) + ' — ' + t(pair.channel)}
                  aria-describedby={hintId}
                  checked={pair.enabled}
                  onChange={(e) =>
                    void change({ preferences: [consentPatch(pair, e.target.checked)] })
                  }
                  className="size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                />
              </label>
            ))}
          </fieldset>
          <fieldset disabled={disabled} className="space-y-3 disabled:opacity-70">
            <legend className="font-semibold">{t('quietHours')}</legend>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>{t('quietEnabled')}</span>
              <input
                type="checkbox"
                role="switch"
                checked={data.quietHoursEnabled}
                onChange={(e) => void change({ quietHoursEnabled: e.target.checked })}
                className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
              />
            </label>
            <p className="text-sm text-muted-foreground">
              {t('timezone', { zone: data.timezone ?? t('invalidZone') })}
            </p>
            {data.timezone === null && (
              <p role="alert" className="text-sm text-destructive">
                {t('timezoneWarning')}
              </p>
            )}
          </fieldset>
          <QuietTimes
            key={data.quietStartMinute + ':' + data.quietEndMinute}
            data={data}
            disabled={disabled}
            change={change}
          />
          <fieldset disabled={disabled} className="space-y-3 border-t pt-4 disabled:opacity-70">
            <legend className="font-semibold">{t('reminder')}</legend>
            <div className="flex flex-wrap gap-3">
              {([15, 60, 1440] as const).map((minutes) => (
                <label
                  key={minutes}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm has-checked:border-primary"
                >
                  <input
                    type="radio"
                    name="notification-reminder"
                    checked={data.reminderLeadMinutes === minutes}
                    onChange={() => void change({ reminderLeadMinutes: minutes })}
                    className="accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                  />
                  {t('lead' + minutes)}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <p className="text-sm text-muted-foreground">{t('securityException')}</p>
      {!connected && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('offline')}
        </p>
      )}
      {shown &&
        connected &&
        (query.isFetching || mutation.isPending || (query.isPending && !error && !denied)) && (
          <p role="status">{t(mutation.isPending ? 'saving' : 'loading')}</p>
        )}
      {(error || denied) && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{t(denied ? 'sessionError' : mutation.isError ? 'saveError' : 'loadError')}</p>
          {!denied && (
            <Button
              variant="outline"
              disabled={!connected || !shown || query.isFetching || mutation.isPending}
              onClick={() => void reload()}
            >
              {t('retry')}
            </Button>
          )}
        </div>
      )}
      {mutation.isSuccess && data && !query.isFetching && (
        <p role="status" className="text-sm text-primary">
          {t('saved')}
        </p>
      )}
    </section>
  );
}
