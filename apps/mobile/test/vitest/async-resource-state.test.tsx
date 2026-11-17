import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react-native';
import { AsyncResourceState } from '@/shared/ui/async-resource-state';

describe('AsyncResourceState (native)', () => {
  it('shows a retry action for failed resources', async () => {
    const onRetry = vi.fn();
    const view = await render(
      <AsyncResourceState kind="error" message="Збій завантаження" onRetry={onRetry} />,
    );
    expect(view.getByText('Збій завантаження')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Спробувати ще раз' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no retry action in empty and loading states', async () => {
    const view = await render(<AsyncResourceState kind="empty" message="Немає даних" />);
    expect(view.getByText('Немає даних')).toBeTruthy();
    expect(view.queryByRole('button')).toBeNull();
  });
});
