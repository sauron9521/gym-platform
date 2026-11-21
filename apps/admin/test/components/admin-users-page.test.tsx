import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { headersMock, cookiesMock, sessionMock, localeState } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  cookiesMock: vi.fn(),
  sessionMock: vi.fn(),
  localeState: { current: 'uk' as 'uk' | 'en' },
}));

vi.mock('next/headers', () => ({ headers: headersMock, cookies: cookiesMock }));
vi.mock('@/shared/api/admin-session', () => ({ readAdminSession: sessionMock }));
vi.mock('@/shared/ui/locale-switcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('@/shared/ui/theme-switcher', () => ({ ThemeSwitcher: () => null }));
vi.mock('next-intl/server', async () => {
  const { getMessages } = await import('@gym/i18n');
  return {
    getLocale: async () => localeState.current,
    getTranslations: async (namespace: string) => (key: string) => {
      const admin = getMessages(localeState.current).admin;
      const catalog = (namespace === 'admin.users' ? admin.users : admin) as Record<string, string>;
      return catalog[key];
    },
  };
});

import AdminUsersPage, { dynamic } from '../../src/app/users/page';

beforeEach(() => {
  vi.resetAllMocks();
  localeState.current = 'uk';
  cookiesMock.mockResolvedValue({ get: () => undefined });
  headersMock.mockResolvedValue({
    get: (name: string) => (name === 'cookie' ? 'sid=admin-session' : null),
  });
});

afterEach(cleanup);

describe('Admin users route', () => {
  test.each([
    ['unauthenticated', 'Для доступу потрібна окрема адміністративна сесія.'],
    ['forbidden', 'У вас немає адміністративного доступу.'],
    ['unavailable', 'Неможливо перевірити права. Спробуйте пізніше.'],
  ] as const)(
    'fails closed for %s without rendering directory or reading theme',
    async (kind, message) => {
      sessionMock.mockResolvedValue({ kind });
      const { container } = render(await AdminUsersPage());
      expect(screen.getByRole('alert').textContent).toContain(message);
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.queryByRole('searchbox')).toBeNull();
      expect(cookiesMock).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain('sid=admin-session');
      expect(sessionMock).toHaveBeenCalledExactlyOnceWith('sid=admin-session');
    },
  );

  test('allows server-verified ADMIN but does not fabricate users or call an unimplemented API', async () => {
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'private-admin-id' });
    const { container } = render(await AdminUsersPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Користувачі' })).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Список користувачів поки недоступний');
    expect(screen.getByRole('searchbox')).toHaveProperty('disabled', true);
    expect(container.textContent).not.toContain('private-admin-id');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(cookiesMock).toHaveBeenCalledOnce();
  });

  test('has English copy and stays dynamically rendered', async () => {
    localeState.current = 'en';
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'admin-123' });
    render(await AdminUsersPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeTruthy();
    expect(screen.getByText('User directory unavailable')).toBeTruthy();
    expect(dynamic).toBe('force-dynamic');
  });
});
