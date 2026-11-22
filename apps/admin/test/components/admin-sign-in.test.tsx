import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { post, get, router } = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  router: { replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock('@gym/api-client', () => ({
  createBrowserSessionClient: () => ({ POST: post, GET: get }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/shared/ui/locale-switcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => namespace + '.' + key,
}));

import AdminSignInPage from '../../src/app/sign-in/page';

afterEach(cleanup);

function submit() {
  fireEvent.change(screen.getByLabelText('auth.email'), {
    target: { value: 'admin@example.test' },
  });
  fireEvent.change(screen.getByLabelText('auth.password'), {
    target: { value: 'password-example' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'auth.signIn' }));
}

describe('Admin sign-in with same-origin cookie session', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('verifies admin-purpose cookie via GET /auth/admin-session before opening the Admin page', async () => {
    post.mockResolvedValue({ response: { status: 200 }, data: { mfaRequired: false } });
    get.mockResolvedValue({ response: { status: 200 }, data: { role: 'ADMIN' } });
    render(<AdminSignInPage />);

    submit();
    await waitFor(() => expect(router.replace).toHaveBeenCalledExactlyOnceWith('/'));
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith('/auth/admin-login', {
      body: { email: 'admin@example.test', password: 'password-example' },
    });
    expect(get).toHaveBeenCalledWith('/auth/admin-session');
  });

  it('denies non-ADMIN role and tries to discard the new session', async () => {
    post.mockResolvedValue({ response: { status: 200 }, data: { mfaRequired: false } });
    get.mockResolvedValue({ response: { status: 200 }, data: { role: 'ATHLETE' } });
    render(<AdminSignInPage />);

    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('admin.forbidden'));
    expect(post).toHaveBeenCalledWith('/auth/admin-sign-out');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not use a pending-MFA session or call profile on MFA challenge', async () => {
    post.mockResolvedValue({ response: { status: 200 }, data: { mfaRequired: true } });
    render(<AdminSignInPage />);

    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('admin.mfaRequired'));
    expect(get).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith('/auth/admin-sign-out');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('handles rejected credentials without privileged navigation', async () => {
    post.mockResolvedValue({ response: { status: 401 }, data: undefined });
    render(<AdminSignInPage />);

    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('admin.signInFailed'));
    expect(get).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
