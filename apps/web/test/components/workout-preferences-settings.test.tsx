import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from '@gym/i18n';

import { WorkoutPreferencesSettings } from '@/features/app-settings/ui/workout-preferences-settings';
import { workoutPreferencesKey } from '@/features/app-settings/api/workout-preferences';
import type {
  StoredWorkoutPreferences,
  WorkoutPreferencesPatch,
} from '@/features/app-settings/api/workout-preferences';

const { get, patch, replace } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('@/shared/api/client', () => ({ webApi: { GET: get, PATCH: patch } }));
const router = { replace };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

let client: QueryClient;
let owner: string;
let stored: StoredWorkoutPreferences;
const resource = '/users/me/preferences/workouts';
const ok = (data: unknown) => ({ response: { status: 200 }, data });
const fail = (status: number) => ({ response: { status } });
const toggle = () =>
  screen.getByRole('switch', { name: 'Automatic rest timer' }) as HTMLInputElement;
const duration = (seconds: number) =>
  screen.getByRole('radio', { name: `${seconds} s` }) as HTMLInputElement;
const disabled = () => toggle().closest('fieldset')?.disabled;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  owner = 'athlete-a';
  stored = { autoRestTimer: null, restDurationSeconds: null };
  onlineManager.setOnline(true);
  replace.mockReset();
  get
    .mockReset()
    .mockImplementation(async (path: string) =>
      path === '/users/me' ? ok({ id: owner }) : ok(stored),
    );
  patch
    .mockReset()
    .mockImplementation(async (_path: string, { body }: { body: WorkoutPreferencesPatch }) => {
      stored = { ...stored, ...body };
      return ok(stored);
    });
});
afterEach(() => {
  cleanup();
  client.clear();
  onlineManager.setOnline(true);
});

function mount(accountId = 'athlete-a', locale: 'uk' | 'en' = 'en') {
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={getMessages(locale)}>
        <WorkoutPreferencesSettings accountId={accountId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function ready() {
  await waitFor(() => expect(disabled()).toBe(false));
}

describe('account workout settings', () => {
  it('reads unset fields as shared defaults without writing them', async () => {
    mount();
    await ready();
    expect(toggle().checked).toBe(true);
    expect(duration(90).checked).toBe(true);
    expect(screen.getByRole('heading', { name: 'App settings' })).toBeTruthy();
    expect(patch).not.toHaveBeenCalled();
    expect(get.mock.calls.filter(([path]) => path === resource)).toHaveLength(1);
  });

  it('preserves explicit false and uses only the changed field in each PATCH', async () => {
    stored = { autoRestTimer: false, restDurationSeconds: 60 };
    mount();
    await ready();
    expect(toggle().checked).toBe(false);
    expect(duration(60).checked).toBe(true);
    fireEvent.click(duration(120));
    await waitFor(() => expect(duration(120).checked && !disabled()).toBe(true));
    expect(patch).toHaveBeenNthCalledWith(1, resource, { body: { restDurationSeconds: 120 } });
    expect(toggle().checked).toBe(false);
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle().checked && !disabled()).toBe(true));
    expect(patch).toHaveBeenNthCalledWith(2, resource, { body: { autoRestTimer: true } });
    expect(client.getQueryData(workoutPreferencesKey(owner))).toEqual({
      autoRestTimer: true,
      restDurationSeconds: 120,
    });
  });

  it('does not optimistically update and blocks another write while saving', async () => {
    mount();
    await ready();
    let finish!: (value: unknown) => void;
    patch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    fireEvent.click(duration(120));
    await waitFor(() => expect(patch).toHaveBeenCalledOnce());
    expect(disabled()).toBe(true);
    expect(duration(90).checked).toBe(true);
    fireEvent.click(toggle());
    expect(patch).toHaveBeenCalledOnce();
    stored = { autoRestTimer: null, restDurationSeconds: 120 };
    await act(async () => finish(ok(stored)));
    await waitFor(() => expect(duration(120).checked && !disabled()).toBe(true));
  });

  it('reconciles a lost acknowledgement using GET and never repeats PATCH', async () => {
    mount();
    await ready();
    patch.mockImplementationOnce(async () => {
      stored = { autoRestTimer: false, restDurationSeconds: 90 };
      throw new Error('lost response');
    });
    fireEvent.click(toggle());
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Could not confirm'),
    );
    await waitFor(() => expect(toggle().checked).toBe(false));
    expect(patch).toHaveBeenCalledOnce();
    expect(get.mock.calls.filter(([path]) => path === resource).length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh settings' }));
    await ready();
    expect(patch).toHaveBeenCalledOnce();
  });

  it('disables offline writes, refreshes on reconnect and never queues mutations', async () => {
    mount();
    await ready();
    await act(async () => onlineManager.setOnline(false));
    expect(disabled()).toBe(true);
    expect(screen.getByText('Offline. Reconnect to change account settings.')).toBeTruthy();
    fireEvent.click(toggle());
    expect(patch).not.toHaveBeenCalled();
    stored = { autoRestTimer: false, restDurationSeconds: 60 };
    await act(async () => onlineManager.setOnline(true));
    await waitFor(() => expect(duration(60).checked && !disabled()).toBe(true));
    expect(patch).not.toHaveBeenCalled();
  });

  it('never requests preferences for a mismatched browser session', async () => {
    owner = 'athlete-b';
    mount();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('account changed'));
    expect(get.mock.calls.some(([path]) => path === resource)).toBe(false);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('rechecks session owner before PATCH and hides old controls after account switch', async () => {
    mount();
    await ready();
    owner = 'athlete-b';
    fireEvent.click(toggle());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('account changed'));
    expect(patch).not.toHaveBeenCalled();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('rejects malformed response and allows read-only retry', async () => {
    get.mockImplementation(async (path: string) =>
      path === '/users/me'
        ? ok({ id: owner })
        : ok({ autoRestTimer: true, restDurationSeconds: 91 }),
    );
    mount();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not load'));
    expect(screen.queryByRole('switch')).toBeNull();
    get.mockImplementation(async (path: string) =>
      path === '/users/me' ? ok({ id: owner }) : ok(stored),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refresh settings' }));
    await ready();
    expect(patch).not.toHaveBeenCalled();
  });

  it('redirects only on 401 and clears the private cache', async () => {
    get.mockResolvedValue(fail(401));
    client.setQueryData(['private'], 'private');
    mount();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(client.getQueryData(['private'])).toBeUndefined();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('renders Ukrainian translations', async () => {
    mount('athlete-a', 'uk');
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Автоматичний таймер' })).toBeTruthy(),
    );
    expect(screen.getByRole('heading', { name: 'Налаштування застосунку' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '90 с' })).toBeTruthy();
  });
});
