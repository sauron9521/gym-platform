'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { getForgotPasswordErrorMessage } from '../lib/password-reset-flow';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || submitted) return;

    setSubmitting(true);
    setError(null);
    try {
      const { response } = await webApi.POST('/auth/password-reset/forgot', {
        body: { email: email.trim() },
      });

      if (response.status !== 202) {
        setError(getForgotPasswordErrorMessage(response.status));
        return;
      }

      // HTTP 202 acknowledges processing, not whether the account exists
      // or whether an email was sent or delivered.
      setEmail('');
      setSubmitted(true);
    } catch {
      setError('Немає з’єднання з API. Спробуйте пізніше.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="mt-8 space-y-5">
        <p role="status" className="text-sm leading-6">
          Якщо обліковий запис із такою адресою існує, інструкції з відновлення пароля можуть
          надійти на пошту. Перевірте також папку «Спам».
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Повернутися до входу</Link>
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="recovery-email" className="block text-sm font-medium">
          Електронна адреса
        </label>
        <input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={submitting}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Надсилаємо запит…' : 'Надіслати інструкції'}
      </Button>
      <p className="text-sm text-muted-foreground">
        Пригадали пароль?{' '}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Увійти
        </Link>
      </p>
    </form>
  );
}
