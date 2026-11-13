'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { classifySessionCheck, getLoginErrorMessage } from '../lib/auth-flow';

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { data, response } = await webApi.POST('/auth/login', {
        body: { email: email.trim(), password },
      });

      if (response.status !== 200 || !data) {
        setError(getLoginErrorMessage(response.status));
        return;
      }

      if (data.mfaRequired) {
        // No MFA challenge screen yet: do not treat a pending-MFA session as signed in.
        // The API explicitly permits signing out a pending-MFA session.
        try {
          await webApi.POST('/auth/sign-out');
        } catch {
          // Best effort; the pending session must not unlock the dashboard.
        }
        setError('Для цього облікового запису потрібна MFA. Підтримку додамо окремо.');
        return;
      }

      // A successful login is not enough if the browser rejected the session cookie.
      const account = await webApi.GET('/users/me');
      const decision = classifySessionCheck(account.response.status, Boolean(account.data));

      if (decision !== 'authenticated') {
        setError(
          decision === 'unauthenticated'
            ? 'Не вдалося зберегти сесію. Перевірте cookie та адресу API.'
            : 'Не вдалося підтвердити сесію. Спробуйте ще раз.',
        );
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Немає з’єднання з API. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">
          Електронна пошта
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Вхід…' : 'Увійти'}
      </Button>
    </form>
  );
}
