import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntlProvider } from 'react-intl';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { getMobileMessages } from '@/shared/i18n/mobile-messages';
import { OfflineDraftLifecycle } from '@/features/workouts/model/offline-draft-lifecycle';
import type { EncryptedOfflineDraftStorage } from '@/features/workouts/model/encrypted-draft-storage';
import { createOfflineWorkoutDraft } from '@/features/workouts/lib/offline-workout-draft';

import { useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { useCreateMultiMobileWorkout } from '@/features/workouts/model/workout-create';
import { CreateWorkoutScreen } from '@/screens/workouts/ui/create-workout-screen';

const back = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const scoped = vi.hoisted(() => vi.fn());
vi.mock('expo-crypto', () => ({ randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }));
vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: () => ({
    account: { id: '22222222-2222-4222-8222-222222222222' },
    capabilities: { athlete: true, trainer: false, admin: false },
    getScopedApi: scoped,
  }),
}));

vi.mock('expo-router', () => ({ useRouter: () => ({ back }) }));
vi.mock('@/features/exercises/model/exercises-query', () => ({
  useExercisesQuery: vi.fn(),
}));
vi.mock('@/features/workouts/model/workout-create', () => ({
  useCreateMultiMobileWorkout: vi.fn(),
}));

const mutateAsync = vi.fn();
const ownerId = '22222222-2222-4222-8222-222222222222';
const grants = { athlete: true, trainer: false, admin: false };
const exerciseId = '11111111-1111-4111-8111-111111111111';

const renderScreen = (lifecycle?: OfflineDraftLifecycle) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IntlProvider locale="uk" messages={getMobileMessages('uk')}>
        <CreateWorkoutScreen lifecycle={lifecycle} />
      </IntlProvider>
    </QueryClientProvider>,
  );

async function draftHarness(initial: string | null = null) {
  let value = initial;
  const storage = {
    read: vi.fn(async () => value),
    write: vi.fn(async (_owner: string, next: string) => {
      value = next;
    }),
    remove: vi.fn(async () => {
      value = null;
    }),
    prepareVerifiedOwner: vi.fn(async () => undefined),
    purgePersistedOwner: vi.fn(async () => {
      value = null;
    }),
  } satisfies EncryptedOfflineDraftStorage;
  const lifecycle = new OfflineDraftLifecycle(storage);
  await lifecycle.verified(ownerId, grants);
  return {
    lifecycle,
    storage,
    get value() {
      return value;
    },
  };
}

const storedForm = {
  title: 'Локальні груди',
  exercises: [{ exerciseId, sets: [{ reps: '12', weightKg: '65' }] }],
};
const persisted = JSON.stringify(createOfflineWorkoutDraft(ownerId, storedForm, 123));

async function confirmAlert() {
  const calls = vi.mocked(Alert.alert).mock.calls;
  await act(async () => calls.at(-1)?.[2]?.[1]?.onPress?.());
}

function prepare() {
  vi.mocked(useExercisesQuery).mockReturnValue({
    data: {
      pages: [{ data: [{ id: exerciseId, name: 'Жим лежачи', isArchived: false }] }],
    },
    isPending: false,
    isError: false,
    isFetching: false,
    hasNextPage: false,
  } as unknown as ReturnType<typeof useExercisesQuery>);

  vi.mocked(useCreateMultiMobileWorkout).mockReturnValue({
    mutateAsync,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useCreateMultiMobileWorkout>);
}

describe('Multi-exercise CreateWorkoutScreen (native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue('workout-created');
    onlineManager.setOnline(true);
    scoped.mockImplementation((guard: () => boolean) => (guard() ? { POST: post } : null));
    post.mockResolvedValue({
      response: { status: 201 },
      data: { id: '33333333-3333-4333-8333-333333333333', athleteId: ownerId },
    });
    prepare();
  });

  it('adds and removes nested exercises and sets without deleting the final item', async () => {
    const view = await renderScreen();

    expect(view.getByRole('button', { name: 'Видалити вправу 1', disabled: true })).toBeTruthy();
    expect(
      view.getByRole('button', { name: 'Прибрати підхід 1 вправи 1', disabled: true }),
    ).toBeTruthy();

    await fireEvent.press(view.getByTestId('workout-set-add-0'));
    expect(view.getByText('Підхід 2')).toBeTruthy();

    await fireEvent.press(view.getByTestId('workout-set-remove-0-1'));
    expect(view.queryByText('Підхід 2')).toBeNull();

    await fireEvent.press(view.getByTestId('workout-exercise-add'));
    expect(view.getByText('Вправа 2')).toBeTruthy();

    await fireEvent.press(view.getByTestId('workout-exercise-remove-1'));
    expect(view.queryByText('Вправа 2')).toBeNull();
  });

  it('submits validated nested form data and navigates only on mutation success', async () => {
    const view = await renderScreen();

    await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Спина');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    await fireEvent.changeText(view.getByLabelText('Планова вага, вправа 1, підхід 1'), '62,5');
    await fireEvent.press(view.getByTestId('workout-set-add-0'));
    await fireEvent.changeText(view.getByLabelText('Повторення, вправа 1, підхід 2'), '8');
    await fireEvent.press(view.getByTestId('create-workout-submit'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync).toHaveBeenCalledWith({
      title: 'Спина',
      exercises: [
        {
          exerciseId,
          sets: [
            { reps: '10', weightKg: '62,5' },
            { reps: '8', weightKg: '' },
          ],
        },
      ],
    });
    await waitFor(() => expect(back).toHaveBeenCalledOnce());
  });

  it('keeps the form open on a failed POST and does not navigate', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('Мережа недоступна'));
    const view = await renderScreen();

    await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Спина');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(back).not.toHaveBeenCalled();
  });
  it('blocks repeat submission while pending and preserves nested values for a manual retry after failure', async () => {
    let reject: (error: Error) => void = () => undefined;
    mutateAsync.mockReturnValueOnce(
      new Promise<string>((_resolve, fail) => {
        reject = fail;
      }),
    );
    const view = await renderScreen();
    await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Груди');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    await fireEvent.changeText(view.getByLabelText('Планова вага, вправа 1, підхід 1'), '65');
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(view.getByTestId('create-workout-submit').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    expect(mutateAsync).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
    await act(async () => reject(new Error('Lost response')));
    await waitFor(() =>
      expect(view.getByTestId('create-workout-submit').props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    expect(view.getByLabelText('Назва тренування').props.value).toBe('Груди');
    expect(view.getByLabelText('Планова вага, вправа 1, підхід 1').props.value).toBe('65');
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    await waitFor(() => expect(back).toHaveBeenCalledOnce());
    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync.mock.calls[1]?.[0]).toEqual(mutateAsync.mock.calls[0]?.[0]);
  });
  it('saves valid data locally, blocks duplicate POST, and requires explicit discard confirmation', async () => {
    const h = await draftHarness();
    const view = await renderScreen(h.lifecycle);
    await waitFor(() =>
      expect(view.getByTestId('workout-draft-save').props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Груди');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    await fireEvent.press(view.getByTestId('workout-draft-save'));
    await waitFor(() =>
      expect(
        view.getByText('Чернетку збережено на пристрої. Не надіслано на сервер.'),
      ).toBeTruthy(),
    );
    expect(JSON.parse(h.value!).form.title).toBe('Груди');
    expect(h.storage.write).toHaveBeenCalledOnce();
    expect(view.getByTestId('create-workout-submit').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    expect(mutateAsync).not.toHaveBeenCalled();
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await fireEvent.press(view.getByTestId('workout-draft-discard'));
      expect(h.storage.remove).not.toHaveBeenCalled();
      await confirmAlert();
      await waitFor(() => expect(view.getByText('Чернетку видалено.')).toBeTruthy());
      expect(h.value).toBeNull();
      expect(view.getByLabelText('Назва тренування').props.value).toBe('');
      expect(mutateAsync).not.toHaveBeenCalled();
    } finally {
      alert.mockRestore();
    }
  });

  it('requires explicit restore, clears restored form on lock and never submits it', async () => {
    const h = await draftHarness(persisted);
    const view = await renderScreen(h.lifecycle);
    await waitFor(() => expect(view.getByTestId('workout-draft-restore')).toBeTruthy());
    expect(view.getByLabelText('Назва тренування').props.value).toBe('');
    expect(view.getByTestId('workout-draft-save').props.accessibilityState.disabled).toBe(true);
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await fireEvent.press(view.getByTestId('workout-draft-restore'));
      expect(view.getByLabelText('Назва тренування').props.value).toBe('');
      await confirmAlert();
      await waitFor(() =>
        expect(view.getByLabelText('Назва тренування').props.value).toBe(storedForm.title),
      );
      expect(view.getByLabelText('Планова вага, вправа 1, підхід 1').props.value).toBe('65');
      expect(view.getByTestId('create-workout-submit').props.accessibilityState.disabled).toBe(
        true,
      );
      await act(async () => h.lifecycle.lock());
      expect(view.queryByDisplayValue(storedForm.title)).toBeNull();
      await act(async () => {
        await h.lifecycle.verified(ownerId, grants);
      });
      await waitFor(() => expect(view.getByTestId('workout-draft-restore')).toBeTruthy());
      expect(view.getByLabelText('Назва тренування').props.value).toBe('');
      expect(mutateAsync).not.toHaveBeenCalled();
      expect(h.value).toBe(persisted);
    } finally {
      alert.mockRestore();
    }
  });

  it('does not save an invalid form or send an automatic mutation', async () => {
    const h = await draftHarness();
    const view = await renderScreen(h.lifecycle);
    await waitFor(() =>
      expect(view.getByTestId('workout-draft-save').props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.press(view.getByTestId('workout-draft-save'));
    await waitFor(() =>
      expect(
        view.getByText('Заповніть назву, вправи та коректні підходи для збереження.'),
      ).toBeTruthy(),
    );
    expect(h.storage.write).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('does not apply a confirmation from the old account generation', async () => {
    const h = await draftHarness(persisted);
    const view = await renderScreen(h.lifecycle);
    await waitFor(() => expect(view.getByTestId('workout-draft-restore')).toBeTruthy());
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await fireEvent.press(view.getByTestId('workout-draft-restore'));
      await act(async () => {
        h.lifecycle.lock();
        await h.lifecycle.verified(ownerId, grants);
      });
      await confirmAlert();
      expect(view.getByLabelText('Назва тренування').props.value).toBe('');
      expect(mutateAsync).not.toHaveBeenCalled();
    } finally {
      alert.mockRestore();
    }
  });

  it('does not convert an uncertain normal POST into a local draft', async () => {
    const h = await draftHarness();
    mutateAsync.mockRejectedValueOnce(new Error('Lost response'));
    const view = await renderScreen(h.lifecycle);
    await waitFor(() =>
      expect(view.getByTestId('workout-draft-save').props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Груди');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(
        view.getByText(
          'Після спроби надсилання збереження чернетки заблоковане, щоб уникнути дублювання.',
        ),
      ).toBeTruthy(),
    );
    await fireEvent.press(view.getByTestId('workout-draft-save'));
    expect(h.storage.write).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('keeps normal online creation available when encrypted storage is unavailable', async () => {
    const h = await draftHarness();
    h.storage.prepareVerifiedOwner.mockRejectedValueOnce(new Error('native unavailable'));
    await h.lifecycle.verified(ownerId, grants);
    const view = await renderScreen(h.lifecycle);
    expect(view.getByText('Захищене сховище недоступне на цьому пристрої.')).toBeTruthy();
    expect(view.queryByTestId('workout-draft-save')).toBeNull();
    await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Груди');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    await fireEvent.press(view.getByTestId('create-workout-submit'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    await waitFor(() => expect(back).toHaveBeenCalledOnce());
  });
  it('ignores a pending restore result after a session lock', async () => {
    const h = await draftHarness(persisted);
    const view = await renderScreen(h.lifecycle);
    await waitFor(() => expect(view.getByTestId('workout-draft-restore')).toBeTruthy());
    let finish: (value: string) => void = () => undefined;
    h.storage.read.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await fireEvent.press(view.getByTestId('workout-draft-restore'));
      await confirmAlert();
      await waitFor(() => expect(h.storage.read).toHaveBeenCalledTimes(2));
      await act(async () => {
        h.lifecycle.lock();
        finish(persisted);
      });
      expect(view.queryByDisplayValue(storedForm.title)).toBeNull();
      expect(view.getByLabelText('Назва тренування').props.value).toBe('');
      expect(mutateAsync).not.toHaveBeenCalled();
    } finally {
      alert.mockRestore();
    }
  });

  it('blocks POST after an uncertain local save until explicit discard clears the bound form', async () => {
    const h = await draftHarness();
    h.storage.write.mockRejectedValueOnce(new Error('private storage error'));
    const view = await renderScreen(h.lifecycle);
    await waitFor(() =>
      expect(view.getByTestId('workout-draft-save').props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Груди');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    await fireEvent.press(view.getByTestId('workout-draft-save'));
    await waitFor(() => expect(view.getByTestId('workout-draft-retry')).toBeTruthy());
    expect(view.queryByText('private storage error')).toBeNull();
    expect(view.getByTestId('create-workout-submit').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('workout-draft-retry'));
    await waitFor(() => expect(view.getByText('Збереженої чернетки немає.')).toBeTruthy());
    expect(view.getByTestId('create-workout-submit').props.accessibilityState.disabled).toBe(true);
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await fireEvent.press(view.getByTestId('workout-draft-discard'));
      await confirmAlert();
      await waitFor(() => expect(view.getByLabelText('Назва тренування').props.value).toBe(''));
      expect(mutateAsync).not.toHaveBeenCalled();
    } finally {
      alert.mockRestore();
    }
  });
  it('sends a saved reviewed form only after confirmation, retains receipt and clears without another POST', async () => {
    const h = await draftHarness(persisted);
    const view = await renderScreen(h.lifecycle);
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await waitFor(() => expect(view.getByTestId('workout-draft-restore')).toBeTruthy());
      await fireEvent.press(view.getByTestId('workout-draft-restore'));
      await confirmAlert();
      await waitFor(() => expect(view.getByTestId('workout-draft-send')).toBeTruthy());
      await fireEvent.press(view.getByTestId('workout-draft-send'));
      expect(post).not.toHaveBeenCalled();
      await confirmAlert();
      await waitFor(() => expect(view.getByText('Тренування створено на сервері.')).toBeTruthy());
      expect(post).toHaveBeenCalledExactlyOnceWith('/workouts', {
        headers: { 'Idempotency-Key': 'draft-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        body: {
          title: storedForm.title,
          exercises: [
            { exerciseId, sets: [{ setType: 'WORKING', plannedReps: 12, plannedWeightKg: 65 }] },
          ],
        },
      });
      expect(JSON.parse(h.value!).state).toBe('SUBMISSION_ACKNOWLEDGED');
      expect(view.queryByTestId('workout-draft-send')).toBeNull();
      expect(h.storage.remove).not.toHaveBeenCalled();
      await fireEvent.press(view.getByTestId('workout-draft-clear'));
      await confirmAlert();
      await waitFor(() => expect(view.getByText('Локальну чернетку очищено.')).toBeTruthy());
      expect(h.value).toBeNull();
      expect(post).toHaveBeenCalledOnce();
      expect(mutateAsync).not.toHaveBeenCalled();
    } finally {
      alert.mockRestore();
    }
  });

  it('reopens an ambiguous submission and explicitly retries the exact key/body', async () => {
    const h = await draftHarness(persisted);
    post.mockRejectedValueOnce(new Error('lost response'));
    const view = await renderScreen(h.lifecycle);
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await waitFor(() => expect(view.getByTestId('workout-draft-restore')).toBeTruthy());
      await fireEvent.press(view.getByTestId('workout-draft-restore'));
      await confirmAlert();
      await waitFor(() => expect(view.getByTestId('workout-draft-send')).toBeTruthy());
      await fireEvent.press(view.getByTestId('workout-draft-send'));
      await confirmAlert();
      await waitFor(() => expect(view.getByText('Повторити надсилання')).toBeTruthy());
      expect(JSON.parse(h.value!).state).toBe('SUBMISSION_PENDING');
      expect(post).toHaveBeenCalledOnce();
      expect(view.getByLabelText('Назва тренування').props.editable).toBe(false);
      expect(view.queryByTestId('workout-draft-discard')).toBeNull();
      await view.unmount();
      const reopened = await draftHarness(h.value);
      const next = await renderScreen(reopened.lifecycle);
      await waitFor(() => expect(next.getByTestId('workout-draft-restore')).toBeTruthy());
      expect(next.queryByTestId('workout-draft-send')).toBeNull();
      await fireEvent.press(next.getByTestId('workout-draft-restore'));
      await confirmAlert();
      await waitFor(() => expect(next.getByText('Повторити надсилання')).toBeTruthy());
      expect(post).toHaveBeenCalledOnce();
      await fireEvent.press(next.getByTestId('workout-draft-send'));
      await confirmAlert();
      await waitFor(() => expect(next.getByText('Тренування створено на сервері.')).toBeTruthy());
      expect(post).toHaveBeenCalledTimes(2);
      expect(post.mock.calls[1]).toEqual(post.mock.calls[0]);
    } finally {
      alert.mockRestore();
    }
  });

  it('does not send edited unsaved data or resume automatically on network restoration', async () => {
    const h = await draftHarness(persisted);
    const view = await renderScreen(h.lifecycle);
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await waitFor(() => expect(view.getByTestId('workout-draft-restore')).toBeTruthy());
      await fireEvent.press(view.getByTestId('workout-draft-restore'));
      await confirmAlert();
      await waitFor(() => expect(view.getByTestId('workout-draft-send')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Назва тренування'), 'Незбережені зміни');
      await fireEvent.press(view.getByTestId('workout-draft-send'));
      await confirmAlert();
      await waitFor(() =>
        expect(
          view.getByText(
            'Не вдалося підтвердити надсилання. Перевірте збережену форму та стан чернетки; автоматичного повтору немає.',
          ),
        ).toBeTruthy(),
      );
      expect(post).not.toHaveBeenCalled();
      await act(async () => onlineManager.setOnline(false));
      expect(view.queryByTestId('workout-draft-send')).toBeNull();
      await act(async () => onlineManager.setOnline(true));
      expect(post).not.toHaveBeenCalled();
      expect(JSON.parse(h.value!).state).toBe('REQUIRES_REVIEW');
    } finally {
      alert.mockRestore();
    }
  });

  it('retries only cleanup after a confirmed submission even if removal made the record unreadable', async () => {
    const h = await draftHarness(persisted);
    const view = await renderScreen(h.lifecycle);
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await waitFor(() => expect(view.getByTestId('workout-draft-restore')).toBeTruthy());
      await fireEvent.press(view.getByTestId('workout-draft-restore'));
      await confirmAlert();
      await waitFor(() => expect(view.getByTestId('workout-draft-send')).toBeTruthy());
      await fireEvent.press(view.getByTestId('workout-draft-send'));
      await confirmAlert();
      await waitFor(() => expect(view.getByTestId('workout-draft-clear')).toBeTruthy());
      h.storage.remove.mockRejectedValueOnce(new Error('file cleanup failed'));
      await fireEvent.press(view.getByTestId('workout-draft-clear'));
      await confirmAlert();
      await waitFor(() =>
        expect(
          view.getByText(
            'Не вдалося очистити локальну копію. Серверне тренування вже створено. Повторіть лише очищення.',
          ),
        ).toBeTruthy(),
      );
      h.storage.read.mockRejectedValue(new Error('key removed'));
      await fireEvent.press(view.getByTestId('workout-draft-clear'));
      await confirmAlert();
      await waitFor(() => expect(view.getByText('Локальну чернетку очищено.')).toBeTruthy());
      expect(post).toHaveBeenCalledOnce();
      expect(h.storage.remove).toHaveBeenCalledTimes(2);
    } finally {
      alert.mockRestore();
    }
  });
});
