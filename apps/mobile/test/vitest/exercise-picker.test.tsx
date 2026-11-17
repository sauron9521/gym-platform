import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react-native';

import { useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { ExercisePicker } from '@/features/exercises/ui/exercise-picker';

vi.mock('@/features/exercises/model/exercises-query', () => ({ useExercisesQuery: vi.fn() }));

describe('ExercisePicker (native)', () => {
  it('allows choosing an exercise from the fetched library', async () => {
    vi.mocked(useExercisesQuery).mockReturnValue({
      data: { pages: [{ data: [{ id: 'exercise-1', name: 'Жим лежачи', isArchived: false }] }] },
      isPending: false,
      isError: false,
      hasNextPage: false,
    } as unknown as ReturnType<typeof useExercisesQuery>);
    const onSelect = vi.fn();
    const view = await render(<ExercisePicker selectedId="" onSelect={onSelect} />);
    await fireEvent.press(view.getByText('Жим лежачи'));
    expect(onSelect).toHaveBeenCalledWith('exercise-1');
  });
});
