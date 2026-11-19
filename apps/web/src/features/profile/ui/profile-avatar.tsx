'use client';

import { useState, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/ui/button';
import { useAvatarMutation } from '../api/avatar-mutations';
import {
  getAvatarErrorKey,
  getAvatarInitials,
  getAvatarSource,
  getAvatarValidationKey,
} from '../lib/avatar';

type Props = {
  avatarUrl: string | null | undefined;
  displayName: string;
  email: string;
  onChanged: () => Promise<boolean>;
};

export function ProfileAvatar({ avatarUrl, displayName, email, onChanged }: Props) {
  const t = useTranslations('web.profileAvatar');
  const [file, setFile] = useState<File | null>(null);
  const mutation = useAvatarMutation();
  const busy = mutation.isPending;
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const source = getAvatarSource(avatarUrl);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.currentTarget.value = '';
    setMessage(null);
    mutation.reset();
    setConfirmDelete(false);
    const validation = selected ? getAvatarValidationKey(selected) : null;
    setFile(validation ? null : selected);
    setError(validation ? t(validation) : null);
  }

  async function changeAvatar(action: 'upload' | 'delete') {
    if (busy || (action === 'upload' && !file)) return;
    setError(null);
    setMessage(null);
    mutation.reset();
    try {
      if (action === 'upload') {
        if (!file) return;
        await mutation.mutateAsync({ action: 'upload', file });
      } else {
        await mutation.mutateAsync({ action: 'delete' });
      }

      if (!(await onChanged())) {
        setError(t('refetchError'));
        return;
      }
      setFile(null);
      setConfirmDelete(false);
      setMessage(action === 'upload' ? t('uploaded') : t('deleted'));
    } catch {
      // Preserve the file and confirmation for an explicit retry.
    }
  }

  return (
    <section aria-label={t('section')} className="space-y-4 rounded-xl border p-6">
      <div className="flex items-center gap-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold">
          {source ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt={t('photo')}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span aria-label={t('initials')}>{getAvatarInitials(displayName, email)}</span>
          )}
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t('heading')}</h2>
          <p className="text-sm text-muted-foreground">{t('hint')}</p>
        </div>
      </div>
      <div className="space-y-3">
        <label htmlFor="avatar-file" className="block text-sm font-medium">
          {t('choose')}
        </label>
        <input
          id="avatar-file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={selectFile}
          disabled={busy}
          className="block w-full text-sm"
        />
        {file && <p className="text-sm">{t('selected')}: {file.name}</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={!file || busy}
            onClick={() => void changeAvatar('upload')}
          >
            {busy ? t('processing') : t('upload')}
          </Button>
          {source && !confirmDelete && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              {t('delete')}
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
                {t('confirmDelete')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                {t('cancel')}
              </Button>
            </>
          )}
        </div>
      </div>
      {(error || mutation.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? (mutation.error ? t(getAvatarErrorKey(mutation.error.status)) : null)}
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
