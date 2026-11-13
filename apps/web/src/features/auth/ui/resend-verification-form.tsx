'use client';

import Link from 'next/link';
import { useState } from 'react';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { getResendErrorMessage } from '../lib/email-verification-flow';

type ResendState = 'ready' | 'sending' | 'submitted';

export function ResendVerificationForm() {
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
        setError(getResendErrorMessage(response.status));
        setState('ready');
        return;
      }

      setState('submitted');
    } catch {
      setError('Немає з’єднання з API. Спробуйте пізніше.');
      setState('ready');
    }
  }

  if (state === 'submitted') {
    return (
      <div className="mt-6 space-y-4">
        <p role="status" className="text-sm leading-6">
          Запит на повторне надсилання листа прийнято. Перевірте пошту та папку «Спам».
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Повернутися до кабінету</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">
        Лист надсилається лише на адресу вашого облікового запису. Для повторного надсилання
        потрібно увійти.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        className="w-full"
        type="button"
        disabled={state === 'sending'}
        onClick={handleResend}
      >
        {state === 'sending' ? 'Надсилаємо…' : 'Надіслати лист ще раз'}
      </Button>
      <p className="text-sm text-muted-foreground">
        Немає активної сесії?{' '}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Увійти
        </Link>
      </p>
    </div>
  );
}
