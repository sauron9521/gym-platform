'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { webApi } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { ProfileAvatar } from './profile-avatar';
import {
  buildProfilePatch,
  getProfileErrorMessage,
  profileSchema,
  toProfileDraft,
  type Account,
  type ProfileDraft,
} from '../lib/profile-form';

const fields: { key: keyof ProfileDraft; label: string; type?: string; placeholder?: string }[] = [
  { key: 'firstName', label: 'Ім’я', placeholder: 'Ім’я' },
  { key: 'lastName', label: 'Прізвище', placeholder: 'Прізвище' },
  { key: 'displayName', label: 'Відображуване ім’я' },
  { key: 'birthday', label: 'Дата народження', type: 'date' },
  { key: 'height', label: 'Зріст (см)', type: 'number' },
  { key: 'weight', label: 'Вага (кг)', type: 'number' },
  { key: 'timezone', label: 'Часовий пояс', placeholder: 'Europe/Kyiv' },
];

const emptyProfile: ProfileDraft = {
  firstName: '',
  lastName: '',
  displayName: '',
  birthday: '',
  height: '',
  weight: '',
  timezone: 'Europe/Kyiv',
};

export function ProfileEditor() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [unauthenticated, setUnauthenticated] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileDraft>({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyProfile,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  async function loadProfile(): Promise<boolean> {
    try {
      const { data, response } = await webApi.GET('/users/me');
      if (response.status === 401) {
        setUnauthenticated(true);
        return false;
      }
      if (response.status !== 200 || !data) {
        setError(getProfileErrorMessage(response.status));
        return false;
      }
      setAccount(data);
      reset(toProfileDraft(data), { keepDirtyValues: true });
      setError(null);
      return true;
    } catch {
      setError('Немає з’єднання з API. Спробуйте пізніше.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void webApi
      .GET('/users/me')
      .then(({ data, response }) => {
        if (!active) return;
        if (response.status === 401) {
          setUnauthenticated(true);
        } else if (response.status !== 200 || !data) {
          setError(getProfileErrorMessage(response.status));
        } else {
          setAccount(data);
          reset(toProfileDraft(data));
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError('Немає з’єднання з API. Спробуйте пізніше.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reset]);

  async function submit(values: ProfileDraft) {
    if (!account) return;
    const result = buildProfilePatch(values);
    if (!result.data) {
      setError(result.error ?? 'Некоректні дані.');
      return;
    }
    setSuccess(false);
    setError(null);
    try {
      const { response } = await webApi.PATCH('/users/me', { body: result.data });
      if (response.status === 401) {
        setUnauthenticated(true);
        return;
      }
      if (response.status !== 200) {
        setError(getProfileErrorMessage(response.status));
        return;
      }
      if (await loadProfile()) {
        reset(values);
        setSuccess(true);
      }
    } catch {
      setError('Немає з’єднання з API. Спробуйте пізніше.');
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <h1 className="text-3xl font-semibold">Мій профіль</h1>
      {loading && <p role="status">Завантаження профілю…</p>}
      {unauthenticated && (
        <p role="alert">
          Сесію завершено.{' '}
          <Link className="underline" href="/login">
            Увійти повторно
          </Link>
          .
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {success && !error && (
        <p role="status" className="text-sm">
          Профіль оновлено.
        </p>
      )}
      {!unauthenticated && account && (
        <ProfileAvatar
          avatarUrl={account.profile?.avatarUrl}
          displayName={account.profile?.displayName || account.profile?.firstName || ''}
          email={account.email}
          onChanged={loadProfile}
        />
      )}
      {!unauthenticated && account && (
        <form
          onSubmit={handleSubmit(submit)}
          noValidate
          className="space-y-5 rounded-xl border p-6"
        >
          <p className="text-sm text-muted-foreground">Пошта: {account.email}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ key, label, type = 'text', placeholder }) => (
              <div key={key} className="space-y-2">
                <label htmlFor={key} className="block text-sm font-medium">
                  {label}
                </label>
                <input
                  id={key}
                  type={type}
                  placeholder={placeholder}
                  step={type === 'number' ? '0.01' : undefined}
                  min={key === 'height' ? 50 : key === 'weight' ? 1 : undefined}
                  max={key === 'height' ? 300 : key === 'weight' ? 600 : undefined}
                  maxLength={type === 'text' ? 100 : undefined}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors[key])}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                  {...register(key, { onChange: () => setSuccess(false) })}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
                {errors[key] && (
                  <p id={`${key}-error`} role="alert" className="text-xs text-destructive">
                    {errors[key].message}
                  </p>
                )}
              </div>
            ))}
          </div>
          <Button disabled={isSubmitting || !isDirty} type="submit">
            {isSubmitting ? 'Зберігаємо…' : 'Зберегти зміни'}
          </Button>
        </form>
      )}
      {!loading && !account && !unauthenticated && (
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true);
            void loadProfile();
          }}
        >
          Спробувати знову
        </Button>
      )}
    </main>
  );
}
