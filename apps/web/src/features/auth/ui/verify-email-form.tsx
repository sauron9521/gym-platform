'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { getVerificationErrorMessage } from '../lib/email-verification-flow';

type VerificationState = 'ready' | 'verifying' | 'verified' | 'error';

export function VerifyEmailForm({ token }: { token: string | null }) {
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
        setError(getVerificationErrorMessage(response.status));
        setState('error');
        return;
      }
      setState('verified');
    } catch {
      setError('Немає з’єднання з API. Спробуйте пізніше.');
      setState('error');
    }
  }

  if (!token) {
    return (
      <div className="mt-6 space-y-4">
        <p role="alert" className="text-sm text-destructive">
          У посиланні відсутній коректний токен підтвердження.
        </p>
        <Button asChild variant="outline">
          <Link href="/verify-email/resend">Отримати новий лист</Link>
        </Button>
      </div>
    );
  }

  if (state === 'verified') {
    return (
      <div className="mt-6 space-y-5">
        <p role="status" className="text-sm leading-6">
          Електронну адресу підтверджено. Тепер можете перейти до кабінету.
        </p>
        <Button asChild className="w-full">
          <Link href="/dashboard">До кабінету</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">
        Натисніть кнопку, щоб підтвердити електронну адресу. Посилання можна використати лише
        один раз.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" type="button" onClick={handleVerify} disabled={state === 'verifying'}>
        {state === 'verifying' ? 'Підтверджуємо…' : 'Підтвердити email'}
      </Button>
      <p className="text-sm text-muted-foreground">
        Посилання недійсне?{' '}
        <Link href="/verify-email/resend" className="font-medium text-foreground hover:underline">
          Надіслати нове
        </Link>
      </p>
    </div>
  );
}
