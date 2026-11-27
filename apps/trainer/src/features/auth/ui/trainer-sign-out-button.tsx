'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import type { Locale } from '@gym/i18n';

import { getTrainerCopy } from '@/shared/i18n/copy';
import { signOutTrainer } from '../lib/trainer-sign-out';

export function TrainerSignOutButton() {
  const t = getTrainerCopy(useLocale() as Locale);
  const router = useRouter();
  const active = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    // Ref prevents duplicate POST requests before React updates disabled.
    if (active.current) return;
    active.current = true;
    setSubmitting(true);
    setError(null);

    try {
      if ((await signOutTrainer()) === 'signedOut') {
        window.dispatchEvent(new Event('trainer-session-ended'));
        router.replace('/login');
        router.refresh();
        // Keep the control disabled until unmount/navigation.
        return;
      }
    } catch {
      // Also fail closed if navigation helpers or fetch implementations throw.
    }

    setError(t.logoutUnavailable);
    active.current = false;
    setSubmitting(false);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={submitting}
        onClick={signOut}
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {submitting ? t.loggingOut : t.logout}
      </button>
      {error && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
