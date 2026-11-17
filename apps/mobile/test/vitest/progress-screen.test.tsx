import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react-native';

import { useWorkoutSummary } from '@/features/progress/model/workout-summary-query';
import { ProgressScreen } from '@/screens/progress/ui/progress-screen';

vi.mock('@/features/progress/model/workout-summary-query', () => ({
  useWorkoutSummary: vi.fn(),
}));

const refetch = vi.fn();

function prepare(withError = false) {
  vi.mocked(useWorkoutSummary).mockReturnValue({
    data: withError
      ? undefined
      : {
          workoutCount: 1,
          activeDays: 1,
          completedSets: 3,
          strengthVolumeKg: 0,
          asOf: '2026-11-17T10:00:00.000Z',
          daily: [{ date: '2026-11-17', strengthVolumeKg: 0 }],
        },
    isPending: false,
    isError: withError,
    isFetching: false,
    error: withError ? new Error('Немає з’єднання') : null,
    refetch,
  } as unknown as ReturnType<typeof useWorkoutSummary>);
}

describe('Mobile ProgressScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refetch.mockResolvedValue(undefined);
    prepare();
  });

  it('does not show a positive-volume chart for zero strength volume', async () => {
    const view = await render(<ProgressScreen />);
    expect(view.getByText('За цей період немає записаного силового об’єму.')).toBeTruthy();
    expect(view.getByText('Тренувальний об’єм за днями')).toBeTruthy();
  });

  it('uses a separate query for the selected period', async () => {
    const view = await render(<ProgressScreen />);
    expect(useWorkoutSummary).toHaveBeenCalledWith('30d');
    await fireEvent.press(view.getByTestId('progress-range-7d'));
    expect(useWorkoutSummary).toHaveBeenCalledWith('7d');
  });

  it('exposes a manual retry after a recoverable error', async () => {
    prepare(true);
    const view = await render(<ProgressScreen />);
    expect(view.getByText('Немає з’єднання')).toBeTruthy();
    await fireEvent.press(view.getByTestId('progress-retry'));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
