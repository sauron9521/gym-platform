import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { headersMock, sessionMock, healthMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  sessionMock: vi.fn(),
  healthMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: headersMock }));
vi.mock('@/shared/api/admin-session', () => ({ readAdminSession: sessionMock }));
vi.mock('@/shared/api/admin-health', () => ({ readAdminHealth: healthMock }));

import AdminHomePage, { dynamic } from '../../src/app/page';

type AccessState = 'unauthenticated' | 'forbidden' | 'unavailable';

beforeEach(() => {
  vi.resetAllMocks();
  healthMock.mockResolvedValue('healthy');
  headersMock.mockResolvedValue({
    get: (name: string) => (name === 'cookie' ? 'sid=browser-session' : null),
  });
});

afterEach(cleanup);

async function renderAdminPage() {
  // Next renders this async server component after reading the HTTP request headers.
  render(await AdminHomePage());
}

describe('AdminHomePage server-side access control', () => {
  test.each([
    ['unauthenticated', 'Для доступу потрібна окрема адміністративна сесія.'],
    ['forbidden', 'У вас немає адміністративного доступу.'],
    ['unavailable', 'Неможливо перевірити права. Спробуйте пізніше.'],
  ] as const)('denies %s without rendering the protected console', async (kind, message) => {
    sessionMock.mockResolvedValue({ kind });
    await renderAdminPage();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Адмін-панель недоступна');
    expect(alert.textContent).toContain(message);
    expect(screen.queryByRole('heading', { name: 'Адміністративна консоль' })).toBeNull();
    expect(sessionMock).toHaveBeenCalledExactlyOnceWith('sid=browser-session');
  });

  test('shows the protected console only after server verification of an admin session', async () => {
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'admin-123' });
    await renderAdminPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Адміністративна консоль' })).toBeTruthy();
    expect(screen.getByText('Доступ підтверджено NestJS API.')).toBeTruthy();
    expect(screen.getByText('Gym Platform Admin')).toBeTruthy();
    expect(screen.getByText(/PostgreSQL і rate limiting/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(sessionMock).toHaveBeenCalledExactlyOnceWith('sid=browser-session');
  });

  test('keeps the server session ID and cookie out of HTML', async () => {
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'secret-admin-id' });
    const { container } = render(await AdminHomePage());

    expect(container.textContent).not.toContain('secret-admin-id');
    expect(container.textContent).not.toContain('sid=browser-session');
  });

  test('provides an empty cookie when no cookie header was sent', async () => {
    headersMock.mockResolvedValue({ get: () => null });
    sessionMock.mockResolvedValue({ kind: 'unauthenticated' });
    await renderAdminPage();

    expect(sessionMock).toHaveBeenCalledExactlyOnceWith('');
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  test('does not trust an incoming session cookie without admin privileges', async () => {
    headersMock.mockResolvedValue({ get: () => 'sid=spoofed-admin' });
    sessionMock.mockResolvedValue({ kind: 'forbidden' });
    await renderAdminPage();

    expect(sessionMock).toHaveBeenCalledExactlyOnceWith('sid=spoofed-admin');
    expect(screen.getByText('У вас немає адміністративного доступу.')).toBeTruthy();
    expect(screen.queryByText('Доступ підтверджено NestJS API.')).toBeNull();
  });

  test('clearly indicates moderation and dashboard functionality is not yet available', async () => {
    sessionMock.mockResolvedValue({ kind: 'admin', id: 'admin-123' });
    await renderAdminPage();

    expect(screen.getByText(/Функції модерації та метрики з’являться/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /видалити|змінити|модерувати/i })).toBeNull();
  });

  test('requires dynamic server rendering rather than caching a privileged response', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
