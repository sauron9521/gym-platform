'use client';

import { createBrowserSessionClient } from '@gym/api-client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const api = createBrowserSessionClient({ baseUrl: '/backend' });

export default function AdminSignInPage() {
  const router = useRouter();
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
      const { response, data } = await api.POST('/auth/login', {
        body: { email: email.trim(), password },
      });
      if (response.status !== 200 || !data || data.mfaRequired) {
        if (data?.mfaRequired) await api.POST('/auth/sign-out').catch(() => undefined);
        setError('Не вдалося увійти. Перевірте облікові дані та MFA.');
        return;
      }

      const verified = await api.GET('/users/me');
      if (verified.response.status !== 200 || verified.data?.role !== 'ADMIN') {
        await api.POST('/auth/sign-out').catch(() => undefined);
        setError('Цей обліковий запис не має адміністративного доступу.');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('Не вдалося з’єднатися із сервером. Спробуйте пізніше.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">Вхід адміністратора</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label htmlFor="admin-email" className="block text-sm font-medium">
          Електронна пошта
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
          Пароль
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
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Перевіряємо…' : 'Увійти'}
        </button>
      </form>
    </main>
  );
}
