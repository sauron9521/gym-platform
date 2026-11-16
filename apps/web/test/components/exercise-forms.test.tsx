import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { ExerciseDetailsData } from '../../src/features/exercises/lib/exercise-catalog';

const {
  useTaxonomy,
  retryTaxonomy,
  useCreateMutation,
  useEditMutation,
  createExercise,
  editExercise,
  resetCreate,
  resetEdit,
  push,
  refresh,
} = vi.hoisted(() => ({
  useTaxonomy: vi.fn(),
  retryTaxonomy: vi.fn(),
  useCreateMutation: vi.fn(),
  useEditMutation: vi.fn(),
  createExercise: vi.fn(),
  editExercise: vi.fn(),
  resetCreate: vi.fn(),
  resetEdit: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('../../src/features/exercises/ui/use-exercise-taxonomy', () => ({
  useExerciseTaxonomy: useTaxonomy,
}));
vi.mock('../../src/features/exercises/api/exercise-mutations', () => ({
  useCreateExerciseMutation: useCreateMutation,
  useEditExerciseMutation: useEditMutation,
}));

import { CreateExerciseForm } from '../../src/features/exercises/ui/create-exercise-form';
import { EditExerciseForm } from '../../src/features/exercises/ui/edit-exercise-form';

const readyTaxonomy = {
  kind: 'ready' as const,
  muscleGroups: [
    { id: 'muscle-chest', slug: 'chest', name: 'Груди' },
    { id: 'muscle-shoulders', slug: 'shoulders', name: 'Плечі' },
    { id: 'muscle-triceps', slug: 'triceps', name: 'Трицепс' },
  ],
  equipment: [{ id: 'equipment-dumbbell', slug: 'dumbbell', name: 'Гантелі' }],
};

const existingExercise = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Жим гантелей',
  description: 'Початковий опис',
  instructions: 'Виконуйте плавно',
  exerciseType: 'STRENGTH',
  source: 'ATHLETE_CUSTOM',
  visibility: 'PRIVATE',
  isArchived: false,
  createdById: 'owner-1',
  muscleGroups: [
    { role: 'PRIMARY', muscleGroup: { id: 'muscle-shoulders', slug: 'shoulders', name: 'Плечі' } },
    { role: 'SECONDARY', muscleGroup: { id: 'muscle-triceps', slug: 'triceps', name: 'Трицепс' } },
  ],
  equipment: [
    { equipment: { id: 'equipment-dumbbell', slug: 'dumbbell', name: 'Гантелі' } },
  ],
} as unknown as ExerciseDetailsData;

beforeEach(() => {
  vi.clearAllMocks();
  useTaxonomy.mockReturnValue({ state: readyTaxonomy, retry: retryTaxonomy });
  useCreateMutation.mockReturnValue({
    isPending: false,
    isError: false,
    error: null,
    reset: resetCreate,
    mutateAsync: createExercise,
  });
  useEditMutation.mockReturnValue({
    isPending: false,
    isError: false,
    error: null,
    reset: resetEdit,
    mutateAsync: editExercise,
  });
});

afterEach(cleanup);

function addCreateMuscle(slug: string) {
  fireEvent.change(screen.getByLabelText('Група м’язів'), { target: { value: slug } });
  fireEvent.click(screen.getByRole('button', { name: 'Додати групу' }));
}

function fillCreateForm(name = 'Жим гантелей') {
  fireEvent.change(screen.getByRole('textbox', { name: 'Назва' }), {
    target: { value: name },
  });
  addCreateMuscle('chest');
}

function editProps(role: 'ATHLETE' | 'TRAINER' = 'ATHLETE') {
  return {
    exercise: existingExercise,
    role,
    onSaved: vi.fn(),
    onCancel: vi.fn(),
    onReload: vi.fn(),
  };
}

describe('CreateExerciseForm interactions', () => {
  test('blocks saving while taxonomy is loading and renders accessible status', () => {
    useTaxonomy.mockReturnValue({ state: { kind: 'loading' }, retry: retryTaxonomy });
    render(<CreateExerciseForm role="ATHLETE" />);

    expect(screen.getByRole('status').textContent).toContain('Завантажуємо довідники');
    expect(screen.getByRole('button', { name: 'Створити вправу' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(createExercise).not.toHaveBeenCalled();
  });

  test('reports taxonomy loading errors with an actionable retry', () => {
    useTaxonomy.mockReturnValue({
      state: { kind: 'error', message: 'Не вдалося завантажити довідники.' },
      retry: retryTaxonomy,
    });
    render(<CreateExerciseForm role="ATHLETE" />);

    expect(screen.getByRole('alert').textContent).toContain('Не вдалося завантажити довідники');
    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }));
    expect(retryTaxonomy).toHaveBeenCalledOnce();
    expect(createExercise).not.toHaveBeenCalled();
  });

  test('rejects short names and missing primary muscle without posting', async () => {
    render(<CreateExerciseForm role="ATHLETE" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Назва' }), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Створити вправу' }));

    expect(await screen.findByText('Мінімум 2 символи.')).toBeTruthy();
    expect(await screen.findByText(/потрібна основна група без повторів/)).toBeTruthy();
    expect(createExercise).not.toHaveBeenCalled();
  });

  test('does not allow duplicate muscle groups', () => {
    render(<CreateExerciseForm role="ATHLETE" />);
    addCreateMuscle('chest');
    addCreateMuscle('chest');

    expect(screen.getByRole('alert').textContent).toContain('Цю м’язову групу вже додано.');
    expect(screen.getAllByRole('button', { name: 'Прибрати' })).toHaveLength(1);
  });

  test('athlete submission sends normalized exercise payload and navigates', async () => {
    createExercise.mockResolvedValue({ id: 'new-exercise' });
    render(<CreateExerciseForm role="ATHLETE" />);
    fillCreateForm('  Жим гантелей  ');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Гантелі' }));
    fireEvent.change(screen.getByLabelText('Видимість вправи'), {
      target: { value: 'SELECTED_TRAINERS' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Створити вправу' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/exercises/new-exercise'));
    expect(createExercise).toHaveBeenCalledWith({
      name: 'Жим гантелей',
      exerciseType: 'STRENGTH',
      visibility: 'SELECTED_TRAINERS',
      muscleGroups: [{ slug: 'chest', role: 'PRIMARY' }],
      equipment: ['dumbbell'],
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Вправу створено' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  test('trainer submissions never expose or send athlete-only visibility', async () => {
    createExercise.mockResolvedValue({ id: 'trainer-exercise' });
    render(<CreateExerciseForm role="TRAINER" />);
    expect(screen.queryByLabelText('Видимість вправи')).toBeNull();
    fillCreateForm();
    fireEvent.click(screen.getByRole('button', { name: 'Створити вправу' }));

    await waitFor(() => expect(createExercise).toHaveBeenCalledOnce());
    expect(createExercise.mock.calls[0][0]).not.toHaveProperty('visibility');
  });
});

describe('EditExerciseForm interactions', () => {
  test('prepopulates existing data, disables unchanged submissions and cancels', () => {
    const props = editProps();
    render(<EditExerciseForm {...props} />);
    expect((screen.getByRole('textbox', { name: 'Назва' }) as HTMLInputElement).value).toBe(
      'Жим гантелей',
    );
    expect(screen.getByRole('button', { name: 'Зберегти зміни' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect((screen.getByRole('checkbox', { name: 'Гантелі' }) as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }));
    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(editExercise).not.toHaveBeenCalled();
  });

  test('rejects an invalid edited name without sending PATCH', async () => {
    const props = editProps();
    render(<EditExerciseForm {...props} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Назва' }), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }));

    expect(await screen.findByText('Мінімум 2 символи.')).toBeTruthy();
    expect(editExercise).not.toHaveBeenCalled();
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  test('submits only changed fields, converts cleared text to null and calls onSaved', async () => {
    const props = editProps();
    const saved = { ...existingExercise, name: 'Новий жим' } as ExerciseDetailsData;
    editExercise.mockResolvedValue(saved);
    render(<EditExerciseForm {...props} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Назва' }), {
      target: { value: '  Новий жим  ' },
    });
    fireEvent.change(screen.getByLabelText('Опис'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Гантелі' }));
    fireEvent.change(screen.getByLabelText('Приватність'), {
      target: { value: 'SELECTED_TRAINERS' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(saved));
    expect(useEditMutation).toHaveBeenCalledWith(existingExercise.id);
    expect(editExercise).toHaveBeenCalledWith({
      name: 'Новий жим',
      description: null,
      equipment: [],
      visibility: 'SELECTED_TRAINERS',
    });
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  test('trainer edits cannot expose or send athlete-only visibility', async () => {
    const props = editProps('TRAINER');
    editExercise.mockResolvedValue(existingExercise);
    render(<EditExerciseForm {...props} />);
    expect(screen.queryByLabelText('Приватність')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Назва' }), {
      target: { value: 'Жим лежачи' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }));

    await waitFor(() => expect(editExercise).toHaveBeenCalledOnce());
    expect(editExercise).toHaveBeenCalledWith({ name: 'Жим лежачи' });
  });

  test('removing the only primary muscle blocks save', async () => {
    const props = editProps();
    render(<EditExerciseForm {...props} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Прибрати' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }));

    expect(await screen.findByText(/принаймні одну основну/)).toBeTruthy();
    expect(editExercise).not.toHaveBeenCalled();
  });

  test('shows a safe mutation error with a reload action', () => {
    const props = editProps();
    useEditMutation.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error('Вправа вже змінилася. Оновіть дані й спробуйте ще раз.'),
      reset: resetEdit,
      mutateAsync: editExercise,
    });
    render(<EditExerciseForm {...props} />);

    expect(screen.getByRole('alert').textContent).toContain('Вправа вже змінилася');
    fireEvent.click(screen.getByRole('button', { name: 'Оновити вправу' }));
    expect(props.onReload).toHaveBeenCalledOnce();
  });
});
