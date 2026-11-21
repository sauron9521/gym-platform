'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { FormFeedback } from '@/shared/ui/form-feedback';
import { getResendErrorKey } from '../lib/email-verification-flow';

type ResendState = 'ready' | 'sending' | 'submitted';

export function ResendVerificationForm() {
  const t = useTranslations('web.verification');
  const [state, setState] = useState<ResendState>('ready');
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    if (state !== 'ready') return;
    setState('sending');
    setError(null);

    try {
      // Requires an authenticated session. Never accept an arbitrary email
      // from the browser: NestJS sends only to the signed-in account owner.
      const { response } = await webApi.POST('/auth/email/verification');

      if (response.status !== 202) {
        setError(t(getResendErrorKey(response.status)));
        setState('ready');
        return;
      }

      setState('submitted');
    } catch {
      setError(t('network'));
      setState('ready');
    }
  }

  if (state === 'submitted') {
    return (
      <div className="mt-6 space-y-4">
        <p role="status" className="text-sm leading-6">
          {t('accepted')}
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">{t('backDashboard')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">{t('instructionsResend')}</p>
      <FormFeedback message={error} />
      <Button
        className="w-full"
        type="button"
        disabled={state === 'sending'}
        onClick={handleResend}
      >
        {state === 'sending' ? t('sending') : t('resend')}
      </Button>
      <p className="text-sm text-muted-foreground">
        {t('noSession')}{' '}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          {t('login')}
        </Link>
      </p>
    </div>
  );
}
