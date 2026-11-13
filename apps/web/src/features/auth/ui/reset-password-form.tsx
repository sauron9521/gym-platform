'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  getResetPasswordErrorMessage,
  validatePasswordResetInput,
} from '../lib/password-reset-flow';

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A mail client or link scanner may open the GET URL. Never consume the
    // one-time token on page load; remove it from visible browser history.
    if (window.location.search) {
      window.history.replaceState(window.history.state, '', '/reset-password');
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || submitting || completed) return;

    const validationError = validatePasswordResetInput(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { response } = await webApi.POST('/auth/password-reset/reset', {
        body: { token, password },
      });

      if (response.status !== 200) {
        setError(getResetPasswordErrorMessage(response.status));
        return;
      }

      // The API can create a session after reset, potentially pending MFA.
      // Never treat HTTP 200 alone as permission to open protected pages.
      // Users can sign in via the existing session-verified login flow.
      setPassword('');
      setConfirmation('');
      setCompleted(true);
    } catch {
      setError('Немає з’єднання з API. Спробуйте пізніше.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mt-8 space-y-4">
        <p role="alert" className="text-sm text-destructive">
          Посилання для відновлення пароля відсутнє або некоректне.
        </p>
        <Button asChild variant="outline">
          <Link href="/forgot-password">Запросити нове посилання</Link>
        </Button>
      </div>
    );
  }

  if (completed) {
    return (
      <section className="mt-8 space-y-5">
        <p role="status" className="text-sm leading-6">
          Пароль успішно змінено. Для доступу до кабінету увійдіть із новим паролем.
        </p>
        <Button asChild className="w-full">
          <Link href="/login">Перейти до входу</Link>
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="new-password" className="block text-sm font-medium">
          Новий пароль
        </label>
        <input
          id="new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={submitting}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="reset-password-hint"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <p id="reset-password-hint" className="text-xs text-muted-foreground">
          Щонайменше 8 символів, великі й малі літери, цифра та спеціальний символ.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm-new-password" className="block text-sm font-medium">
          Повторіть пароль
        </label>
        <input
          id="confirm-new-password"
          name="confirm-new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={submitting}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Змінюємо пароль…' : 'Змінити пароль'}
      </Button>
      <p className="text-sm text-muted-foreground">
        Посилання не працює?{' '}
        <Link href="/forgot-password" className="font-medium text-foreground hover:underline">
          Запросити нове
        </Link>
      </p>
    </form>
  );
}
