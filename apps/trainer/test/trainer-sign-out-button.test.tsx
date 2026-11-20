// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TrainerSignOutButton } from '../src/features/auth/ui/trainer-sign-out-button';
import { signOutTrainer } from '../src/features/auth/lib/trainer-sign-out';

const replace = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
}));

vi.mock('../src/features/auth/lib/trainer-sign-out', () => ({
  signOutTrainer: vi.fn(),
}));

describe('Trainer sign-out button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('navigates to login and refreshes after confirmed logout', async () => {
    vi.mocked(signOutTrainer).mockResolvedValueOnce('signedOut');

    render(<TrainerSignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(signOutTrainer).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('locks immediately against duplicate clicks until the request resolves', async () => {
    let resolveRequest: (result: 'unavailable') => void = () => undefined;
    vi.mocked(signOutTrainer).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(<TrainerSignOutButton />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);

    expect(signOutTrainer).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      resolveRequest('unavailable');
    });

    expect(screen.getByRole('alert').textContent).toContain('Could not end your session');
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not redirect when the API refuses to terminate the session', async () => {
    vi.mocked(signOutTrainer).mockResolvedValueOnce('unavailable');

    render(<TrainerSignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Could not end your session');
    });
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Sign out' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
