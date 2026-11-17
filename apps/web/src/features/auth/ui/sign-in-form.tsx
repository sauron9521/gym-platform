'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { FormFeedback } from '@/shared/ui/form-feedback';
import { Input } from '@/shared/ui/input';
import { classifySessionCheck, getLoginErrorMessage } from '../lib/auth-flow';
import { loginSchema, type LoginValues } from '../lib/login-schema';

export function SignInForm() {
  const t = useTranslations('web.authFields');
  const router = useRouter();
  const queryClient = useQueryClient();
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
        setError(t('mfa'));
        return;
      }

      // A login response alone cannot establish that the browser accepted the session.
      const account = await webApi.GET('/users/me');
      const decision = classifySessionCheck(account.response.status, Boolean(account.data));

      if (decision !== 'authenticated') {
        setError(decision === 'unauthenticated' ? t('sessionMissing') : t('sessionUnavailable'));
        return;
      }

      queryClient.clear();
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError(t('network'));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">
          {t('email')}
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...register('email', { onChange: () => setError(null) })}
        />
        {errors.email && (
          <p id="login-email-error" role="alert" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium">
          {t('password')}
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          {...register('password', { onChange: () => setError(null) })}
        />
        {errors.password && (
          <p id="login-password-error" role="alert" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      <FormFeedback message={error} />
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t('signingIn') : t('signIn')}
      </Button>
    </form>
  );
}
