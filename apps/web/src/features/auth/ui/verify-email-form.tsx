'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { getVerificationErrorKey } from '../lib/email-verification-flow';

type VerificationState = 'ready' | 'verifying' | 'verified' | 'error';

export function VerifyEmailForm({ token }: { token: string | null }) {
  const t = useTranslations('web.verification');
  const [state, setState] = useState<VerificationState>('ready');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Remove the one-time token from browser history without starting a new
    // navigation. Never automatically consume tokens: mail scanners open links.
    if (window.location.search) {
      window.history.replaceState(window.history.state, '', '/verify-email');
    }
  }, []);

  async function handleVerify() {
    if (!token || state === 'verifying' || state === 'verified') return;
    setState('verifying');
    setError(null);

    try {
      // Public endpoint: a successful POST consumes this one-time token.
      const { response } = await webApi.POST('/auth/email/verify', {
        body: { token },
      });
      if (response.status !== 200) {
        setError(t(getVerificationErrorKey(response.status)));
        setState('error');
        return;
      }
      setState('verified');
    } catch {
      setError(t('network'));
      setState('error');
    }
  }

  if (!token) {
    return (
      <div className="mt-6 space-y-4">
        <p role="alert" className="text-sm text-destructive">
          {t('missing')}
        </p>
        <Button asChild variant="outline">
          <Link href="/verify-email/resend">{t('newEmail')}</Link>
        </Button>
      </div>
    );
  }

  if (state === 'verified') {
    return (
      <div className="mt-6 space-y-5">
        <p role="status" className="text-sm leading-6">
          {t('success')}
        </p>
        <Button asChild className="w-full">
          <Link href="/dashboard">{t('dashboard')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">{t('instructions')}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        className="w-full"
        type="button"
        onClick={handleVerify}
        disabled={state === 'verifying'}
      >
        {state === 'verifying' ? t('verifying') : t('verify')}
      </Button>
      <p className="text-sm text-muted-foreground">
        {t('invalid')}{' '}
        <Link href="/verify-email/resend" className="font-medium text-foreground hover:underline">
          {t('sendNew')}
        </Link>
      </p>
    </div>
  );
}
