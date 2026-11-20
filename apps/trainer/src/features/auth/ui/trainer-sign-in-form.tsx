'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type { Locale } from '@gym/i18n';

import { signInTrainer, type TrainerSignInResult } from '../lib/trainer-sign-in';
import { getTrainerCopy } from '@/shared/i18n/copy';

export function TrainerSignInForm() {
  const t = getTrainerCopy(useLocale() as Locale);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const email = data.get('email');
    const password = data.get('password');
    if (typeof email !== 'string' || typeof password !== 'string') return;

    setSubmitting(true);
    setFailure(null);
    try {
      const result = await signInTrainer(email.trim(), password);
      if (result === 'authenticated') {
        form.reset();
        router.replace('/workspace');
        router.refresh();
        return;
      }

      const errors: Record<Exclude<TrainerSignInResult, 'authenticated'>, string> = {
        invalidCredentials: t.loginInvalidCredentials,
        rateLimited: t.loginRateLimited,
        security: t.loginSecurity,
        notApproved: t.loginNotApproved,
        mfaRequired: t.loginMfaRequired,
        unavailable: t.loginUnavailable,
      };
      setFailure(errors[result]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="trainer-email" className="block text-sm font-medium">
          {t.loginEmail}
        </label>
        <input
          id="trainer-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          maxLength={254}
          disabled={submitting}
          onChange={() => setFailure(null)}
          className="min-h-11 w-full rounded-lg border border-input bg-background px-4 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="trainer-password" className="block text-sm font-medium">
          {t.loginPassword}
        </label>
        <input
          id="trainer-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          disabled={submitting}
          onChange={() => setFailure(null)}
          className="min-h-11 w-full rounded-lg border border-input bg-background px-4 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      </div>
      {failure && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {submitting ? t.loginSubmitting : t.loginSubmit}
      </button>
    </form>
  );
}
