import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, vi } from 'vitest';

import { AsyncResourceState } from '@/shared/ui/async-resource-state';

describe('AsyncResourceState (native)', () => {
  it('shows an accessible retry action on error', async () => {
    const onRetry = vi.fn();
    const view = await render(
      <AsyncResourceState kind="error" message="Збій завантаження" onRetry={onRetry} />,
    );

    expect(view.getByText('Збій завантаження')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Спробувати ще раз' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables retry while a refetch is in flight', async () => {
    const onRetry = vi.fn();
    const view = await render(
      <AsyncResourceState kind="error" message="Мережева помилка" onRetry={onRetry} retrying />,
    );
    const retry = view.getByRole('button', { name: 'Спробувати ще раз' });
    expect(retry.props.disabled).toBe(true);
    expect(retry.props.accessibilityState.disabled).toBe(true);
  });

  it('shows a loading message without a retry action', async () => {
    const view = await render(<AsyncResourceState kind="loading" message="Завантаження" />);
    expect(view.getByText('Завантаження')).toBeTruthy();
    expect(view.queryByRole('button')).toBeNull();
  });

  it('shows an empty message without a retry action', async () => {
    const view = await render(<AsyncResourceState kind="empty" message="Немає даних" />);
    expect(view.getByText('Немає даних')).toBeTruthy();
    expect(view.queryByRole('button')).toBeNull();
  });
});
