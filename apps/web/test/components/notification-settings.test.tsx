import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from '@gym/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationSettingsPanel } from '@/features/notifications/ui/notification-settings-panel';
import {
  notificationSettingsKey,
  type NotificationSettings,
  type SettingsPatch,
} from '@/features/notifications/api/settings';
import { formatMinute, parseMinute } from '@/features/notifications/model/settings-time';

const { get, patch, replace } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('@/shared/api/client', () => ({ webApi: { GET: get, PATCH: patch } }));
const router = { replace };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const resource = '/users/me/notification-settings';
const owner = 'account-a';
const stamp = '2026-11-27T09:00:00.000Z';
const defaults: NotificationSettings = {
  quietHoursEnabled: true,
  quietStartMinute: 1320,
  quietEndMinute: 480,
  reminderLeadMinutes: 60,
  timezone: 'Europe/Kyiv',
  preferences: [
    { category: 'TRAINER', channel: 'MOBILE_PUSH', enabled: false, consentedAt: null },
    { category: 'PROGRAM', channel: 'MOBILE_PUSH', enabled: false, consentedAt: null },
    { category: 'WORKOUT', channel: 'LOCAL_REMINDER', enabled: false, consentedAt: null },
    { category: 'ACCOUNT', channel: 'EMAIL', enabled: false, consentedAt: null },
  ],
};
let client: QueryClient;
let stored: NotificationSettings;
let currentOwner: string;
const ok = (data: unknown) => ({ response: { status: 200 }, data });
const fail = (status: number) => ({ response: { status } });
const coaching = () => screen.getByRole('switch', { name: /Coaching updates/ }) as HTMLInputElement;
const start = () => screen.getByLabelText('Quiet hours start') as HTMLInputElement;
const end = () => screen.getByLabelText('Quiet hours end') as HTMLInputElement;
const disabled = () => coaching().closest('fieldset')!.disabled;
const save = () => screen.getByRole('button', { name: 'Save quiet hours' }) as HTMLButtonElement;
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  stored = structuredClone(defaults);
  currentOwner = owner;
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  onlineManager.setOnline(true);
  replace.mockReset();
  get
    .mockReset()
    .mockImplementation(async (_path: string, { headers }: { headers: Record<string, string> }) =>
      headers['x-notification-owner'] === currentOwner ? ok(stored) : fail(409),
    );
  patch
    .mockReset()
    .mockImplementation(
      async (
        _path: string,
        { headers, body }: { headers: Record<string, string>; body: SettingsPatch },
      ) => {
        if (headers['x-notification-owner'] !== currentOwner) return fail(409);
        const { preferences, ...fields } = body;
        stored = {
          ...stored,
          ...fields,
          preferences: stored.preferences.map((old) => {
            const changed = preferences?.find(
              (p) => p.category === old.category && p.channel === old.channel,
            );
            return changed
              ? { ...old, enabled: changed.enabled, consentedAt: changed.enabled ? stamp : null }
              : old;
          }),
        };
        return ok(stored);
      },
    );
});
afterEach(() => {
  cleanup();
  client.clear();
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});
function mount(locale: 'en' | 'uk' = 'en') {
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={getMessages(locale)}>
        <NotificationSettingsPanel accountId={owner} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
async function ready() {
  await screen.findByRole('switch', { name: /Coaching updates/ });
  await waitFor(() => expect(disabled()).toBe(false));
}

describe('Notification preferences panel', () => {
  it('loads server defaults without initializing, native permission or extra profile requests', async () => {
    mount();
    await ready();
    expect(start().value).toBe('22:00');
    expect(end().value).toBe('08:00');
    expect(screen.getByText('Account time zone: Europe/Kyiv')).toBeTruthy();
    expect(screen.getByRole('radio', { name: '1 hour' })).toHaveProperty('checked', true);
    expect(screen.getAllByRole('switch')).toHaveLength(5);
    expect(coaching().checked).toBe(false);
    expect(screen.queryByText(/marketing/i)).toBeNull();
    expect(get).toHaveBeenCalledExactlyOnceWith(resource, {
      headers: { 'x-notification-owner': owner },
      signal: expect.any(AbortSignal),
      cache: 'no-store',
    });
    expect(patch).not.toHaveBeenCalled();
  });
  it('writes only one consent pair, honors canonical response and permits revocation', async () => {
    mount();
    await ready();
    fireEvent.click(coaching());
    await waitFor(() => expect(coaching().checked && !disabled()).toBe(true));
    expect(patch).toHaveBeenNthCalledWith(1, resource, {
      headers: { 'x-notification-owner': owner },
      body: { preferences: [{ category: 'TRAINER', channel: 'MOBILE_PUSH', enabled: true }] },
      cache: 'no-store',
    });
    fireEvent.click(coaching());
    await waitFor(() => expect(!coaching().checked && !disabled()).toBe(true));
    expect(stored.preferences[0]?.consentedAt).toBeNull();
    expect(stored.preferences.slice(1)).toEqual(defaults.preferences.slice(1));
  });
  it('validates equal endpoints and saves both overnight times atomically, then updates reminder', async () => {
    mount();
    await ready();
    fireEvent.change(end(), { target: { value: '22:00' } });
    expect(screen.getByText('Choose two different valid times.')).toBeTruthy();
    expect(save().disabled).toBe(true);
    expect(patch).not.toHaveBeenCalled();
    fireEvent.change(start(), { target: { value: '23:15' } });
    fireEvent.change(end(), { target: { value: '07:30' } });
    expect(screen.getByText('This interval continues across midnight.')).toBeTruthy();
    fireEvent.click(save());
    await waitFor(() => expect(stored.quietStartMinute).toBe(1395));
    await ready();
    expect(stored.quietEndMinute).toBe(450);
    expect(patch.mock.calls[0]?.[1].body).toEqual({ quietStartMinute: 1395, quietEndMinute: 450 });
    fireEvent.click(screen.getByRole('radio', { name: '24 hours' }));
    await waitFor(() => expect(stored.reminderLeadMinutes).toBe(1440));
    expect(patch.mock.calls[1]?.[1].body).toEqual({ reminderLeadMinutes: 1440 });
  });
  it('does not optimistically change consent, blocks duplicate writes and reconciles ambiguous response with GET only', async () => {
    mount();
    await ready();
    let finish!: (v: unknown) => void;
    patch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    fireEvent.click(coaching());
    await waitFor(() => expect(disabled()).toBe(true));
    expect(coaching().checked).toBe(false);
    fireEvent.click(coaching());
    expect(patch).toHaveBeenCalledOnce();
    stored.preferences[0] = { ...stored.preferences[0]!, enabled: true, consentedAt: stamp };
    await act(async () => finish(fail(503)));
    await screen.findByText(
      'Could not confirm the change. Review the current settings before trying again.',
    );
    await waitFor(() => expect(coaching().checked).toBe(true));
    expect(patch).toHaveBeenCalledOnce();
    expect(get.mock.calls.length).toBeGreaterThan(1);
  });
  it('fails closed on owner conflict and does not write the new account', async () => {
    mount();
    await ready();
    currentOwner = 'account-b';
    fireEvent.click(coaching());
    await screen.findByText(
      'Account access changed. Reopen this page after verifying your session.',
    );
    expect(screen.queryByRole('switch', { name: /Coaching updates/ })).toBeNull();
    expect(stored).toEqual(defaults);
    expect(replace).not.toHaveBeenCalled();
  });
  it('clears private cache and redirects only on current 401', async () => {
    mount();
    await ready();
    patch.mockResolvedValueOnce(fail(401));
    fireEvent.click(coaching());
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(client.getQueryData(notificationSettingsKey(owner))).toBeUndefined();
  });
  it('disables writes offline, never replays them and reports invalid canonical zone in Ukrainian', async () => {
    stored.timezone = null;
    mount('uk');
    const section = await screen.findByRole('region', { name: 'Налаштування сповіщень' });
    const toggle = await within(section).findByRole('switch', { name: /Оновлення співпраці/ });
    expect(screen.getByText('Часовий пояс акаунта: Недоступний')).toBeTruthy();
    await act(async () => onlineManager.setOnline(false));
    expect(toggle.closest('fieldset')?.disabled).toBe(true);
    fireEvent.click(toggle);
    await act(async () => onlineManager.setOnline(true));
    expect(patch).not.toHaveBeenCalled();
  });
  it('rejects malformed response rather than presenting fabricated defaults', async () => {
    get.mockResolvedValueOnce(ok({ ...defaults, preferences: defaults.preferences.slice(0, 3) }));
    mount();
    await screen.findByText('Could not load notification settings.');
    expect(screen.queryByRole('switch')).toBeNull();
  });
  it('parses exact wall-clock times without locale or DST conversion', () => {
    expect(formatMinute(0)).toBe('00:00');
    expect(formatMinute(1439)).toBe('23:59');
    expect(parseMinute('23:59')).toBe(1439);
    expect(parseMinute('24:00')).toBeNull();
    expect(parseMinute('7:00')).toBeNull();
    expect(parseMinute('')).toBeNull();
  });
});
