'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useAuthFailure } from '@/shared/api/use-auth-failure';
import { Button } from '@/shared/ui/button';
import { useUpdateProfileMutation, ProfileMutationError } from '../api/profile-mutations';
import { profileQueryOptions, ProfileRequestError } from '../api/profile-query';
import { ProfileAvatar } from './profile-avatar';
import {
  buildProfilePatch,
  profileSchema,
  toProfileDraft,
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
  const t = useTranslations('web.profile');
  const query = useQuery(profileQueryOptions());
  const mutation = useUpdateProfileMutation();
  const onAuthFailure = useAuthFailure();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const account = query.data ?? null;
  const unauthenticated =
    (query.error instanceof ProfileRequestError && query.error.status === 401) ||
    (mutation.error instanceof ProfileMutationError && mutation.error.status === 401);
  const loading = query.isPending || (query.isFetching && !account);
  const message =
    error ??
    (mutation.isError
      ? mutation.error.message
      : query.isError
        ? query.error instanceof ProfileRequestError
          ? query.error.message
          : t('loadError')
        : null);

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

  const busy = isSubmitting || mutation.isPending;

  useEffect(() => {
    if (query.data) {
      // Avatar reloads must not overwrite unsaved form changes.
      reset(toProfileDraft(query.data), { keepDirtyValues: true });
    }
  }, [query.data, reset]);

  useEffect(() => {
    if (query.error instanceof ProfileRequestError) {
      onAuthFailure(query.error);
    }
  }, [query.error, onAuthFailure]);

  async function loadProfile(): Promise<boolean> {
    const result = await query.refetch();
    return result.isSuccess;
  }

  async function submit(values: ProfileDraft) {
    // React Hook Form sets isSubmitting before invoking this callback.
    if (!account || mutation.isPending) return;
    const result = buildProfilePatch(values);
    if (!result.data) {
      setError(result.error ?? t('invalid'));
      return;
    }

    setSuccess(false);
    setError(null);
    mutation.reset();
    try {
      await mutation.mutateAsync(result.data);
      const updated = await query.refetch();
      if (!updated.isSuccess) {
        setError(t('refetchError'));
        return;
      }
      reset(toProfileDraft(updated.data));
      setSuccess(true);
    } catch {
      // Mutation state holds safe status-specific errors and preserves user edits.
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      {loading && <p role="status">{t('loading')}</p>}
      {unauthenticated && (
        <p role="alert">
          Сесію завершено.{' '}
          <Link className="underline" href="/login">
            Увійти повторно
          </Link>
          .
        </p>
      )}
      {message && !unauthenticated && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      {success && !message && (
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
          <p className="text-sm text-muted-foreground">
            {t('email')}: {account.email}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ key, type = 'text', placeholder }) => (
              <div key={key} className="space-y-2">
                <label htmlFor={key} className="block text-sm font-medium">
                  {t(key)}
                </label>
                <input
                  id={key}
                  type={type}
                  placeholder={placeholder && key !== 'timezone' ? t(key) : placeholder}
                  step={type === 'number' ? '0.01' : undefined}
                  min={key === 'height' ? 50 : key === 'weight' ? 1 : undefined}
                  max={key === 'height' ? 300 : key === 'weight' ? 600 : undefined}
                  maxLength={type === 'text' ? 100 : undefined}
                  disabled={busy}
                  aria-invalid={Boolean(errors[key])}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                  {...register(key, {
                    onChange: () => {
                      setSuccess(false);
                      setError(null);
                      mutation.reset();
                    },
                  })}
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
          <Button disabled={busy || !isDirty} type="submit">
            {busy ? t('saving') : t('save')}
          </Button>
        </form>
      )}
      {!loading && !account && !unauthenticated && (
        <Button variant="outline" onClick={() => void query.refetch()}>
          Спробувати знову
        </Button>
      )}
    </main>
  );
}
