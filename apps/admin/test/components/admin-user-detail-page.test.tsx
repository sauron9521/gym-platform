import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { headersMock, cookiesMock, sessionMock, detailMock, locale } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  cookiesMock: vi.fn(),
  sessionMock: vi.fn(),
  detailMock: vi.fn(),
  locale: { value: 'uk' as 'uk' | 'en' },
}));
vi.mock('@/features/notifications/ui/admin-inbox-bell', () => ({
  AdminNotificationBell: () => null,
}));
vi.mock('next/headers', () => ({ headers: headersMock, cookies: cookiesMock }));
vi.mock('@/shared/api/admin-session', () => ({ readAdminSession: sessionMock }));
vi.mock('@/shared/api/admin-user-detail', () => ({ readAdminUserDetail: detailMock }));
vi.mock('@/shared/ui/locale-switcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('@/shared/ui/theme-switcher', () => ({ ThemeSwitcher: () => null }));
vi.mock('next-intl/server', async () => {
  const { getMessages } = await import('@gym/i18n');
  return {
    getLocale: async () => locale.value,
    getTranslations: async (namespace: string) => (key: string) => {
      const admin = getMessages(locale.value).admin;
      const catalog =
        namespace === 'admin.users.detail'
          ? admin.users.detail
          : namespace === 'admin.users'
            ? admin.users
            : admin;
      return (catalog as Record<string, string>)[key];
    },
  };
});

import AdminUserDetailPage, { dynamic, revalidate } from '../../src/app/users/[id]/page';

const id = 'f09d7567-626e-45d8-99f1-829ce4204fbd';
const makePage = () => AdminUserDetailPage({ params: Promise.resolve({ id }) });
const record = {
  id,
  email: 'coach@example.test',
  role: 'TRAINER',
  status: 'ACTIVE',
  emailVerified: true,
  createdAt: '2026-11-20T00:00:00Z',
  updatedAt: '2026-11-21T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  locale.value = 'uk';
  headersMock.mockResolvedValue({
    get: (name: string) => (name === 'cookie' ? 'sid=private' : null),
  });
  cookiesMock.mockResolvedValue({ get: () => undefined });
});
afterEach(cleanup);

describe('Admin account details read-only page', () => {
  test.each(['unauthenticated', 'forbidden', 'unavailable'] as const)(
    'never fetches details before valid ADMIN session: %s',
    async (kind) => {
      sessionMock.mockResolvedValue({ kind });
      const { container } = render(await makePage());
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(detailMock).not.toHaveBeenCalled();
      expect(cookiesMock).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain('coach@example.test');
      expect(container.textContent).not.toContain('sid=private');
    },
  );

  test('shows only server-authorized minimal fields without editing controls or credentials', async () => {
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'operator-private' });
    detailMock.mockResolvedValue({ kind: 'ready', user: record });
    const { container } = render(await makePage());
    expect(detailMock).toHaveBeenCalledExactlyOnceWith('sid=private', id);
    expect(screen.getByRole('heading', { level: 1, name: 'Деталі користувача' })).toBeTruthy();
    expect(screen.getAllByText('coach@example.test')).toHaveLength(2);
    expect(screen.getByText('Підтверджена')).toBeTruthy();
    expect(
      screen.getByText('Перегляд без редагування. Зміна ролей і статусів поки недоступна.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Назад до користувачів' }).getAttribute('href')).toBe(
      '/users',
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /save|зберегти/i })).toBeNull();
    expect(container.textContent).not.toContain('operator-private');
    expect(container.textContent).not.toContain('sid=private');
    expect(dynamic).toBe('force-dynamic');
    expect(revalidate).toBe(0);
  });

  test.each([
    ['forbidden', 'Недостатньо прав'],
    ['not-found', 'Акаунт не знайдено'],
    ['invalid', 'Акаунт не знайдено'],
    ['unavailable', 'Деталі недоступні'],
    ['unauthenticated', 'Сесія завершилася'],
  ] as const)('fails closed for API %s without any user fields', async (kind, message) => {
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'operator' });
    detailMock.mockResolvedValue({ kind });
    const { container } = render(await makePage());
    expect(screen.getByRole('alert').textContent).toContain(message);
    expect(container.textContent).not.toContain('coach@example.test');
    expect(container.textContent).not.toContain('sid=private');
  });

  test('shows persisted suspended status for authorized read-only operator', async () => {
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'operator' });
    detailMock.mockResolvedValue({ kind: 'ready', user: { ...record, status: 'SUSPENDED' } });
    render(await makePage());
    expect(screen.getByText('Призупинений')).toBeTruthy();
  });

  test('renders English translations on detail route', async () => {
    locale.value = 'en';
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'operator' });
    detailMock.mockResolvedValue({ kind: 'ready', user: { ...record, emailVerified: false } });
    render(await makePage());
    expect(screen.getByRole('heading', { level: 1, name: 'User details' })).toBeTruthy();
    expect(screen.getByText('Not verified')).toBeTruthy();
  });
});
