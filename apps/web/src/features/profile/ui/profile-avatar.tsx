'use client';

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';

import { Button } from '@/shared/ui/button';
import {
  avatarErrorMessage,
  getAvatarInitials,
  getAvatarSource,
  validateAvatarFile,
} from '../lib/avatar';

type Props = {
  avatarUrl: string | null | undefined;
  displayName: string;
  email: string;
  onChanged: () => Promise<boolean>;
};

export function ProfileAvatar({ avatarUrl, displayName, email, onChanged }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const source = getAvatarSource(avatarUrl);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.currentTarget.value = '';
    setMessage(null);
    setConfirmDelete(false);
    const validation = selected ? validateAvatarFile(selected) : null;
    setFile(validation ? null : selected);
    setError(validation);
  }

  async function changeAvatar(action: 'upload' | 'delete') {
    if (busy || (action === 'upload' && !file)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      if (action === 'upload' && file) form.append('file', file);
      const response = await fetch('/backend/users/me/avatar', {
        method: action === 'upload' ? 'POST' : 'DELETE',
        credentials: 'include',
        body: action === 'upload' ? form : undefined,
      });
      if (response.status === 401) {
        setSignedOut(true);
        return;
      }
      if (response.status !== 200) {
        setError(avatarErrorMessage(response.status));
        return;
      }
      if (!(await onChanged())) {
        setError('Аватар змінено, але оновити профіль не вдалося.');
        return;
      }
      setFile(null);
      setConfirmDelete(false);
      setMessage(action === 'upload' ? 'Фото профілю оновлено.' : 'Фото профілю видалено.');
    } catch {
      setError('Немає з’єднання з API. Спробуйте пізніше.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Фото профілю" className="space-y-4 rounded-xl border p-6">
      <div className="flex items-center gap-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold">
          {source ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt="Фото профілю"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span aria-label="Ініціали користувача">{getAvatarInitials(displayName, email)}</span>
          )}
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Аватар</h2>
          <p className="text-sm text-muted-foreground">PNG, JPEG або WebP до 2 МіБ.</p>
        </div>
      </div>
      {signedOut ? (
        <p role="alert">
          Сесію завершено.{' '}
          <Link href="/login" className="underline">
            Увійти повторно
          </Link>
        </p>
      ) : (
        <div className="space-y-3">
          <label htmlFor="avatar-file" className="block text-sm font-medium">
            Обрати фотографію
          </label>
          <input
            id="avatar-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={selectFile}
            disabled={busy}
            className="block w-full text-sm"
          />
          {file && <p className="text-sm">Обрано: {file.name}</p>}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={!file || busy}
              onClick={() => void changeAvatar('upload')}
            >
              {busy ? 'Обробка…' : 'Завантажити фото'}
            </Button>
            {source && !confirmDelete && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Видалити фото
              </Button>
            )}
            {source && confirmDelete && (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void changeAvatar('delete')}
                >
                  Підтвердити видалення
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  Скасувати
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
