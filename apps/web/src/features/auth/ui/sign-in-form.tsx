'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { classifySessionCheck, getLoginErrorMessage } from '../lib/auth-flow';
import { loginSchema, type LoginValues } from '../lib/login-schema';

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  async function submit(values: LoginValues) {
    setError(null);

    try {
      const { data, response } = await webApi.POST('/auth/login', {
        body: { email: values.email, password: values.password },
      });

      if (response.status !== 200 || !data) {
        setError(getLoginErrorMessage(response.status));
        return;
      }

      if (data.mfaRequired) {
        // A pending MFA challenge must never unlock private routes.
        try {
          await webApi.POST('/auth/sign-out');
        } catch {
          // Best effort; user still remains on this public route.
        }
        setError('Для цього облікового запису потрібна MFA. Підтримку додамо окремо.');
        return;
      }

      // A login response alone cannot establish that the browser accepted the session.
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
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">
          Електронна пошта
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...register('email', { onChange: () => setError(null) })}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        {errors.email && (
          <p id="login-email-error" role="alert" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          {...register('password', { onChange: () => setError(null) })}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        {errors.password && (
          <p id="login-password-error" role="alert" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
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
