'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useRef, useState } from 'react';

import type { Locale } from '@gym/i18n';

import { getTrainerCopy } from '@/shared/i18n/copy';
import {
  assignTrainerVersion,
  type TrainerAssignVersionResult,
} from '../lib/assign-trainer-version';

type Outcome = TrainerAssignVersionResult['kind'];
type Props = {
  relationId: string;
  programId: string;
  versionId: string;
  versionTitle: string;
  versionNumber: number;
  clientPath: string;
};

export function TrainerAssignVersionButton({
  relationId,
  programId,
  versionId,
  versionTitle,
  versionNumber,
  clientPath,
}: Props) {
  const t = getTrainerCopy(useLocale() as Locale);
  // The ref locks synchronously before React can commit disabled={true}.
  // All attempted POST outcomes remain locked: to retry the user must
  // navigate away and inspect actual assignments, never a blind resend.
  const attempted = useRef(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function submit() {
    if (attempted.current) return;
    attempted.current = true;
    setPending(true);
    let result: TrainerAssignVersionResult;
    try {
      result = await assignTrainerVersion(relationId, programId, versionId);
    } catch {
      result = { kind: 'uncertain' };
    }
    setOutcome(result.kind);
    setPending(false);
  }

  const messages: Record<Exclude<Outcome, 'created'>, string> = {
    unauthenticated: t.programAssignUnauthenticated,
    forbidden: t.programAssignForbidden,
    not_found: t.programAssignNotFound,
    conflict: t.programAssignConflict,
    invalid: t.programAssignInvalid,
    rate_limited: t.programAssignRateLimited,
    uncertain: t.programAssignUncertain,
  };

  return (
    <div className="mt-5 space-y-4">
      <p className="rounded-xl border border-border bg-muted/40 p-5 font-medium">
        {t.programChoiceSelectedVersion}: {versionTitle} — {t.clientAssignmentVersion}{' '}
        {versionNumber}.
      </p>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {pending
          ? t.programAssignPending
          : outcome === 'created'
            ? t.programAssignSuccess
            : outcome
              ? messages[outcome]
              : t.programChoiceNothingSaved}
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={pending || outcome !== null}
        className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t.programAssignPending : t.programAssignSubmit}
      </button>
      {outcome ? (
        <div className="space-y-2">
          {outcome !== 'created' ? (
            <p className="text-sm text-muted-foreground">{t.programAssignNoAutoRetry}</p>
          ) : null}
          <Link
            href={clientPath}
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t.programAssignReview}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
