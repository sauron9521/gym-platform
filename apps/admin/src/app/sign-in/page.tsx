'use client';

import { createBrowserSessionClient } from '@gym/api-client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { LocaleSwitcher } from '@/shared/ui/locale-switcher';

const api = createBrowserSessionClient({ baseUrl: '/backend' });

export default function AdminSignInPage() {
  const router = useRouter();
  const admin = useTranslations('admin');
  const auth = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      const signedIn = await api.POST('/auth/admin-login', {
        body: { email: email.trim(), password },
      });

      if (signedIn.response.status !== 200 || !signedIn.data) {
        setError(admin('signInFailed'));
        return;
      }

      if (signedIn.data.mfaRequired) {
        // A pending MFA session must never grant Admin UI access.
        await api.POST('/auth/admin-sign-out').catch(() => undefined);
        setError(admin('mfaRequired'));
        return;
      }

      const verified = await api.GET('/auth/admin-session');
      if (verified.response.status !== 200 || verified.data?.role !== 'ADMIN') {
        await api.POST('/auth/admin-sign-out').catch(() => undefined);
        setError(admin('forbidden'));
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError(admin('signInUnavailable'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-md space-y-6 px-6 py-16">
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>
      <h1 className="text-3xl font-semibold">{admin('signInTitle')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label htmlFor="admin-email" className="block text-sm font-medium">
          {auth('email')}
        </label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
          className="h-11 w-full rounded-md border border-input bg-background px-3"
        />
        <label htmlFor="admin-password" className="block text-sm font-medium">
          {auth('password')}
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          className="h-11 w-full rounded-md border border-input bg-background px-3"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? admin('signingIn') : auth('signIn')}
        </button>
      </form>
    </main>
  );
}
