import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { post, get, replace, refresh, clear } = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  clear: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ clear }) }));
vi.mock('@/shared/api/client', () => ({ webApi: { POST: post, GET: get } }));
vi.mock('next-intl', async () => {
  const { getMessages } = await import('@gym/i18n');
  const messages = getMessages('uk').web;
  return {
    useTranslations: (namespace: string) => (key: string) => {
      const group = namespace.slice('web.'.length) as keyof typeof messages;
      return (messages[group] as Record<string, string>)[key] ?? key;
    },
  };
});

import { SignInForm } from '../../src/features/auth/ui/sign-in-form';

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  replace.mockReset();
  refresh.mockReset();
  clear.mockReset();
});

afterEach(cleanup);

function submitCredentials(email = 'athlete@example.test', password = 'valid-password') {
  fireEvent.change(screen.getByRole('textbox', { name: 'Електронна пошта' }), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));
}

describe('SignInForm browser interactions', () => {
  test('renders accessible credentials fields without exposing a server error', () => {
    render(<SignInForm />);
    expect(screen.getByRole('textbox', { name: 'Електронна пошта' })).toBeTruthy();
    expect(screen.getByLabelText('Пароль').getAttribute('type')).toBe('password');
    expect(screen.getByRole('button', { name: 'Увійти' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('invalid input shows field-level errors without calling the API', async () => {
    render(<SignInForm />);
    submitCredentials('not-an-email', '  ');
    expect(await screen.findByText('Вкажіть коректну електронну адресу.')).toBeTruthy();
    expect(await screen.findByText('Пароль не може складатися лише з пробілів.')).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  test('invalid credentials show a safe status-specific error without navigation', async () => {
    post.mockResolvedValue({ response: { status: 401 }, data: undefined });
    render(<SignInForm />);
    submitCredentials();
    expect(await screen.findByText('Невірна електронна пошта або пароль.')).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/auth/login', {
      body: { email: 'athlete@example.test', password: 'valid-password' },
    });
    expect(get).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  test('MFA challenges never unlock private routes and attempt sign-out', async () => {
    post.mockResolvedValueOnce({ response: { status: 200 }, data: { mfaRequired: true } });
    post.mockResolvedValueOnce({ response: { status: 200 } });
    render(<SignInForm />);
    submitCredentials();
    expect(await screen.findByText(/потрібна MFA/)).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/auth/sign-out');
    expect(get).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  test('a missing session cookie blocks navigation even after login succeeds', async () => {
    post.mockResolvedValue({ response: { status: 200 }, data: { mfaRequired: false } });
    get.mockResolvedValue({ response: { status: 401 }, data: undefined });
    render(<SignInForm />);
    submitCredentials();
    expect(await screen.findByText(/Не вдалося зберегти сесію/)).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/users/me');
    expect(clear).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  test('confirmed session clears stale queries and navigates to dashboard', async () => {
    post.mockResolvedValue({ response: { status: 200 }, data: { mfaRequired: false } });
    get.mockResolvedValue({ response: { status: 200 }, data: { id: 'athlete-1' } });
    render(<SignInForm />);
    submitCredentials('  athlete@example.test  ');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
    expect(post).toHaveBeenCalledWith('/auth/login', {
      body: { email: 'athlete@example.test', password: 'valid-password' },
    });
    expect(get).toHaveBeenCalledWith('/users/me');
    expect(clear).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
