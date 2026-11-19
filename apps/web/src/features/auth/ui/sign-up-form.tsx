'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import {
  getRegistrationEmailKey,
  getRegistrationErrorKey,
  type VerificationEmailStatus,
} from '../lib/registration-flow';
import { createRegistrationSchema, type RegistrationValues } from '../lib/registration-schema';

type RegistrationSuccess = {
  email: string;
  verificationEmailStatus: VerificationEmailStatus;
};

export function SignUpForm() {
  const t = useTranslations('web.authFields');
  const validation = useTranslations('web.authValidation');
  const registrationError = useTranslations('web.registrationErrors');
  const verification = useTranslations('web.registrationEmail');
  const schema = useMemo(
    () =>
      createRegistrationSchema({
        emailRequired: validation('emailRequired'),
        emailInvalid: validation('emailInvalid'),
        emailTooLong: validation('emailTooLong'),
        passwordMinLength: validation('passwordMinLength'),
        passwordWhitespace: validation('passwordWhitespace'),
        passwordConfirmation: validation('passwordConfirmation'),
        passwordMismatch: validation('passwordMismatch'),
      }),
    [validation],
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegistrationSuccess | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirmation: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  async function submit(values: RegistrationValues) {
    if (success) return;
    setError(null);
    try {
      // The backend owns password strength, email uniqueness and verification delivery.
      const { data, response } = await webApi.POST('/auth/register', {
        body: { email: values.email, password: values.password },
      });
      if (response.status !== 201 || !data) {
        setError(registrationError(getRegistrationErrorKey(response.status)));
        return;
      }

      // Clear submitted credentials immediately after successful registration.
      reset();
      setSuccess({
        email: data.email,
        verificationEmailStatus: data.verificationEmailStatus,
      });
    } catch {
      setError(t('network'));
    }
  }

  if (success) {
    return (
      <section className="mt-8 space-y-5" aria-labelledby="registration-success">
        <h2 id="registration-success" className="text-xl font-semibold">
          {t('created')}
        </h2>
        <p className="text-sm text-muted-foreground">{success.email}</p>
        <p role="status" className="text-sm leading-6">
          {verification(getRegistrationEmailKey(success.verificationEmailStatus))}
        </p>
        <p className="text-sm text-muted-foreground">{t('createdNotice')}</p>
        <Button asChild className="w-full">
          <Link href="/dashboard">{t('openDashboard')}</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          {t('resendPrompt')}{' '}
          <Link href="/verify-email/resend" className="font-medium text-foreground hover:underline">
            {t('resend')}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="register-email" className="block text-sm font-medium">
          {t('email')}
        </label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          maxLength={254}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'register-email-error' : undefined}
          {...register('email', { onChange: () => setError(null) })}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        {errors.email && (
          <p id="register-email-error" role="alert" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="register-password" className="block text-sm font-medium">
          {t('password')}
        </label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password
              ? 'register-password-hint register-password-error'
              : 'register-password-hint'
          }
          {...register('password', { onChange: () => setError(null) })}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <p id="register-password-hint" className="text-xs text-muted-foreground">
          {t('passwordHint')}
        </p>
        {errors.password && (
          <p id="register-password-error" role="alert" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="register-confirmation" className="block text-sm font-medium">
          {t('passwordRepeat')}
        </label>
        <input
          id="register-confirmation"
          type="password"
          autoComplete="new-password"
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.confirmation)}
          aria-describedby={errors.confirmation ? 'register-confirmation-error' : undefined}
          {...register('confirmation', { onChange: () => setError(null) })}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        {errors.confirmation && (
          <p id="register-confirmation-error" role="alert" className="text-xs text-destructive">
            {errors.confirmation.message}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t('signingUp') : t('signUp')}
      </Button>
    </form>
  );
}
