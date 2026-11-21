import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { headersMock, cookiesMock, sessionMock, directoryMock, localeState } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  cookiesMock: vi.fn(),
  sessionMock: vi.fn(),
  directoryMock: vi.fn(),
  localeState: { current: 'uk' as 'uk' | 'en' },
}));

vi.mock('next/headers', () => ({ headers: headersMock, cookies: cookiesMock }));
vi.mock('@/shared/api/admin-session', () => ({ readAdminSession: sessionMock }));
vi.mock('@/shared/api/admin-directory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/shared/api/admin-directory')>();
  return { ...actual, readAdminDirectory: directoryMock };
});
vi.mock('@/shared/ui/locale-switcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('@/shared/ui/theme-switcher', () => ({ ThemeSwitcher: () => null }));
vi.mock('next-intl/server', async () => {
  const { getMessages } = await import('@gym/i18n');
  return {
    getLocale: async () => localeState.current,
    getTranslations: async (namespace: string) => (key: string) => {
      const admin = getMessages(localeState.current).admin;
      const catalog = (namespace === 'admin.users' ? admin.users : admin) as unknown as Record<
        string,
        string
      >;
      return catalog[key];
    },
  };
});

import AdminUsersPage, { dynamic, revalidate } from '../../src/app/users/page';

beforeEach(() => {
  vi.resetAllMocks();
  localeState.current = 'uk';
  cookiesMock.mockResolvedValue({ get: () => undefined });
  headersMock.mockResolvedValue({
    get: (name: string) => (name === 'cookie' ? 'sid=private-admin-session' : null),
  });
});

afterEach(cleanup);

describe('Admin Users route — server-only data boundary', () => {
  test.each([
    ['unauthenticated', 'Для доступу потрібна окрема адміністративна сесія.'],
    ['forbidden', 'У вас немає адміністративного доступу.'],
    ['unavailable', 'Неможливо перевірити права. Спробуйте пізніше.'],
  ] as const)('never fetches or renders users before session check: %s', async (kind, message) => {
    sessionMock.mockResolvedValue({ kind });
    const { container } = render(
      await AdminUsersPage({ searchParams: Promise.resolve({ search: 'test' }) }),
    );
    expect(screen.getByRole('alert').textContent).toContain(message);
    expect(directoryMock).not.toHaveBeenCalled();
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).toBeNull();
    expect(container.textContent).not.toContain('sid=private-admin-session');
  });

  test('shows only API-authorized rows and forwards validated filters with server-only cookie', async () => {
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'internal-id' });
    directoryMock.mockResolvedValue({
      kind: 'ready',
      data: [
        {
          id: 'f09d7567-626e-45d8-99f1-829ce4204fbd',
          email: 'trainer@example.test',
          role: 'TRAINER',
          status: 'ACTIVE',
          createdAt: '2026-11-21T00:00:00Z',
        },
      ],
      meta: { total: 25, skip: 20, take: 20, totalPages: 2 },
    });

    const { container } = render(
      await AdminUsersPage({
        searchParams: Promise.resolve({ search: '  trainer  ', role: 'TRAINER', page: '2' }),
      }),
    );
    expect(directoryMock).toHaveBeenCalledExactlyOnceWith('sid=private-admin-session', {
      search: 'trainer',
      role: 'TRAINER',
      page: 2,
    });
    expect(screen.getByText('trainer@example.test')).toBeTruthy();
    expect(screen.getByText('25 записів')).toBeTruthy();
    expect(container.textContent).not.toContain('internal-id');
    expect(container.textContent).not.toContain('sid=private-admin-session');
  });

  test('a regular ADMIN receives 403 from backend and no user rows', async () => {
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'plain-admin' });
    directoryMock.mockResolvedValue({ kind: 'forbidden' });
    const { container } = render(await AdminUsersPage());
    expect(directoryMock).toHaveBeenCalledExactlyOnceWith('sid=private-admin-session', {
      search: '',
      role: '',
      page: 1,
    });
    expect(screen.getByRole('alert').textContent).toContain('Недостатньо прав для перегляду');
    expect(screen.getByRole('searchbox')).toHaveProperty('disabled', true);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(container.textContent).not.toContain('plain-admin');
  });

  test('invalid filters block API calls even when ADMIN session is valid', async () => {
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'private' });
    render(
      await AdminUsersPage({
        searchParams: Promise.resolve({ role: 'SUPERADMIN', search: 'a', page: '10001' }),
      }),
    );
    expect(directoryMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Некоректні параметри пошуку');
  });

  test('supports English copy, dynamic rendering and uncached responses', async () => {
    localeState.current = 'en';
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'operator' });
    directoryMock.mockResolvedValue({ kind: 'unavailable' });
    render(await AdminUsersPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeTruthy();
    expect(screen.getByText('User directory unavailable')).toBeTruthy();
    expect(dynamic).toBe('force-dynamic');
    expect(revalidate).toBe(0);
  });
});
