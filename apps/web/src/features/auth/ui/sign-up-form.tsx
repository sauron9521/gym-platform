'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  getRegistrationEmailMessage,
  getRegistrationErrorMessage,
  validateRegistrationInput,
  type VerificationEmailStatus,
} from '../lib/registration-flow';

type RegistrationSuccess = {
  email: string;
  verificationEmailStatus: VerificationEmailStatus;
};

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegistrationSuccess | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || success) return;

    const validationError = validateRegistrationInput(email, password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // The backend owns password strength rules, email uniqueness,
      // session creation, and verification email delivery status.
      const { data, response } = await webApi.POST('/auth/register', {
        body: { email: email.trim(), password },
      });
      if (response.status !== 201 || !data) {
        setError(getRegistrationErrorMessage(response.status));
        return;
      }

      // Never retain the submitted password after a successful request.
      setPassword('');
      setConfirmation('');
      setSuccess({
        email: data.email,
        verificationEmailStatus: data.verificationEmailStatus,
      });
    } catch {
      setError('Немає з’єднання з API. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className="mt-8 space-y-5" aria-labelledby="registration-success">
        <h2 id="registration-success" className="text-xl font-semibold">
          Обліковий запис створено
        </h2>
        <p className="text-sm text-muted-foreground">{success.email}</p>
        <p role="status" className="text-sm leading-6">
          {getRegistrationEmailMessage(success.verificationEmailStatus)}
        </p>
        <p className="text-sm text-muted-foreground">
          Реєстрація створила сесію, але пошта ще потребує підтвердження.
        </p>
        <Button asChild className="w-full">
          <Link href="/dashboard">Перейти до кабінету</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Не отримали лист?{' '}
          <Link href="/verify-email/resend" className="font-medium text-foreground hover:underline">
            Надіслати ще раз
          </Link>
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="register-email" className="block text-sm font-medium">
          Електронна пошта
        </label>
        <input
          id="register-email"
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
      <div className="space-y-2">
        <label htmlFor="register-password" className="block text-sm font-medium">
          Пароль
        </label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={submitting}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="register-password-hint"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <p id="register-password-hint" className="text-xs text-muted-foreground">
          Щонайменше 8 символів: великі й малі літери, цифра та спеціальний символ.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="register-confirmation" className="block text-sm font-medium">
          Повторіть пароль
        </label>
        <input
          id="register-confirmation"
          name="confirmation"
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
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Створюємо обліковий запис…' : 'Зареєструватися'}
      </Button>
    </form>
  );
}
