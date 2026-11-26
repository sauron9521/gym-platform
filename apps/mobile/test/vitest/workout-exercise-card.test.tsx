import { useState } from 'react';
import { TextInput } from 'react-native';
import { IntlProvider } from 'react-intl';
import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it } from 'vitest';
import { WorkoutExerciseCard } from '@/screens/workouts/ui/workout-exercise-card';
import { getMobileMessages } from '@/shared/i18n/mobile-messages';
import type { WorkoutDetails } from '@/features/workouts/model/workout-details-query';

type Exercise = WorkoutDetails['exercises'][number];
type Status = Exercise['sets'][number]['status'];
function exercise(statuses: Status[]): Exercise {
  return {
    id: 'exercise-a',
    exerciseNameSnapshot: 'Bench press',
    sets: statuses.map((status, i) => ({ id: String(i), status })),
  } as Exercise;
}
function Draft() {
  const [value, setValue] = useState('60');
  return <TextInput testID="draft" value={value} onChangeText={setValue} />;
}
function card(
  statuses: Status[],
  options: { autoCollapse?: boolean; active?: boolean; confirmed?: boolean; scope?: string } = {},
) {
  return (
    <IntlProvider locale="en" messages={getMobileMessages('en')}>
      <WorkoutExerciseCard
        key={options.scope ?? 'workout-a'}
        exercise={exercise(statuses)}
        autoCollapse={options.autoCollapse ?? true}
        active={options.active ?? true}
        confirmed={options.confirmed ?? true}
      >
        <Draft />
      </WorkoutExerciseCard>
    </IntlProvider>
  );
}

describe('WorkoutExerciseCard', () => {
  it('keeps pending, empty, disabled and inactive cards open', async () => {
    const view = await render(card(['COMPLETED', 'PENDING']));
    for (const fixture of [
      card([]),
      card(['COMPLETED'], { autoCollapse: false }),
      card(['COMPLETED'], { active: false }),
    ]) {
      await view.rerender(fixture);
      expect(view.queryByTestId('exercise-toggle-exercise-a')).toBeNull();
      expect(view.getByTestId('draft').props.value).toBe('60');
    }
  });

  it('waits for confirmation, hides descendants and preserves drafts on manual reopening', async () => {
    const view = await render(card(['PENDING']));
    await fireEvent.changeText(view.getByTestId('draft'), '72.5');
    await view.rerender(card(['COMPLETED', 'SKIPPED'], { confirmed: false }));
    const toggle = () => view.getByTestId('exercise-toggle-exercise-a');
    expect(toggle().props.accessibilityState.expanded).toBe(true);
    expect(toggle().props.accessibilityState.disabled).toBe(true);
    await view.rerender(card(['COMPLETED', 'SKIPPED']));
    expect(toggle().props.accessibilityState.expanded).toBe(false);
    expect(view.getByText('1 completed · 1 skipped / 2')).toBeTruthy();
    const body = view.getByTestId('exercise-sets-exercise-a', { includeHiddenElements: true });
    expect(body.props.importantForAccessibility).toBe('no-hide-descendants');
    await fireEvent.press(toggle());
    expect(toggle().props.accessibilityState.expanded).toBe(true);
    expect(view.getByTestId('draft').props.value).toBe('72.5');
    await view.rerender(card(['COMPLETED', 'SKIPPED'], { confirmed: false }));
    await view.rerender(card(['COMPLETED', 'SKIPPED']));
    expect(toggle().props.accessibilityState.expanded).toBe(true);
    await fireEvent.press(toggle());
    expect(toggle().props.accessibilityState.expanded).toBe(false);
    await view.rerender(card(['COMPLETED', 'SKIPPED'], { confirmed: false }));
    expect(toggle().props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(toggle());
    expect(toggle().props.accessibilityState.expanded).toBe(true);
  });

  it('reopens on a pending set, collapses a new completion episode, resets on scope change', async () => {
    const view = await render(card(['COMPLETED']));
    const toggle = () => view.getByTestId('exercise-toggle-exercise-a');
    await fireEvent.press(toggle());
    expect(toggle().props.accessibilityState.expanded).toBe(true);
    await view.rerender(card(['PENDING']));
    expect(view.queryByTestId('exercise-toggle-exercise-a')).toBeNull();
    await view.rerender(card(['COMPLETED']));
    expect(toggle().props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(toggle());
    await view.rerender(card(['COMPLETED'], { scope: 'workout-b' }));
    expect(toggle().props.accessibilityState.expanded).toBe(false);
  });
});
