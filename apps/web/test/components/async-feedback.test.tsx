import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsyncFeedback } from '@gym/ui-web';

describe('AsyncFeedback', () => {
  afterEach(() => cleanup());
  it('keeps idle feedback out of the accessible tree', () => {
    render(<AsyncFeedback state="idle" message="Idle" />);
    expect(screen.queryByText('Idle')).toBeNull();
  });

  it('announces a pending save without claiming success', () => {
    render(<AsyncFeedback state="loading" message="Зберігаємо…" />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toContain('Зберігаємо…');
  });

  it('uses assertive error feedback and an explicit retry action', () => {
    const retry = vi.fn();
    render(
      <AsyncFeedback
        state="error"
        message="Не вдалося зберегти"
        onRetry={retry}
        retryLabel="Повторити"
      />,
    );
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive');
    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('announces empty responses without claiming success or showing retry', () => {
    render(<AsyncFeedback state="empty" message="Немає записів" />);
    expect(screen.getByRole('status').textContent).toContain('Немає записів');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disables retry when the parent prevents another request', () => {
    const retry = vi.fn();
    render(
      <AsyncFeedback
        state="error"
        message="Помилка"
        onRetry={retry}
        retryLabel="Повторити"
        retryDisabled
      />,
    );
    const button = screen.getByRole('button', { name: 'Повторити' });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(retry).not.toHaveBeenCalled();
  });

  it('does not render a retry button unless the callback and label are both provided', () => {
    render(<AsyncFeedback state="error" message="Помилка" onRetry={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('removes error and retry controls after entering loading, then announces success', () => {
    const retry = vi.fn();
    const view = render(
      <AsyncFeedback state="error" message="Помилка" onRetry={retry} retryLabel="Повторити" />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    view.rerender(<AsyncFeedback state="loading" message="Надсилаємо" />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    view.rerender(<AsyncFeedback state="success" message="Збережено" />);
    expect(screen.getByRole('status').textContent).toContain('Збережено');
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('false');
  });

  it('announces server-confirmed success without a retry action', () => {
    render(<AsyncFeedback state="success" message="Збережено" />);
    expect(screen.getByRole('status').textContent).toContain('Збережено');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
