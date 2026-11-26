import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import {
  mobileMultiWorkoutFormSchema,
  type MobileMultiWorkoutForm,
} from '@/features/workouts/lib/create-workout-schema';
import {
  offlineDraftLifecycle,
  type OfflineDraftLifecycle,
} from '@/features/workouts/model/offline-draft-lifecycle';

import {
  draftBodyJson,
  type PersistedWorkoutDraft,
} from '@/features/workouts/lib/offline-workout-draft';
import { useReviewedDraftSubmission } from '@/features/workouts/model/use-reviewed-draft-submission';

type DraftPresence =
  'checking' | 'none' | 'exists' | 'error' | 'submission-pending' | 'acknowledged';
function presenceOf(draft: PersistedWorkoutDraft | null): DraftPresence {
  if (!draft) return 'none';
  if (draft.state === 'SUBMISSION_PENDING') return 'submission-pending';
  if (draft.state === 'SUBMISSION_ACKNOWLEDGED') return 'acknowledged';
  return 'exists';
}
type Feedback =
  | 'saved'
  | 'restored'
  | 'discarded'
  | 'invalid'
  | 'failed'
  | 'sendFailed'
  | 'sent'
  | 'cleared'
  | 'clearFailed'
  | null;
type Operation = 'check' | 'save' | 'restore' | 'discard' | 'send' | 'clear';
type ViewState = {
  generation: number;
  presence: DraftPresence;
  feedback: Feedback;
  pending: Operation | null;
};

const initial = (generation: number): ViewState => ({
  generation,
  presence: 'checking',
  feedback: null,
  pending: null,
});

/**
 * Local-only review controls. A saved/restored draft cannot use the existing
 * in-memory POST idempotency path. M10.4 owns durable reviewed submission.
 */
export function useWorkoutDraftForm(
  form: UseFormReturn<MobileMultiWorkoutForm>,
  submissionLock: { current: boolean },
  submissionAttempted: { current: boolean },
  lifecycle: OfflineDraftLifecycle = offlineDraftLifecycle,
) {
  const submission = useReviewedDraftSubmission(lifecycle);
  const scope = useSyncExternalStore(
    lifecycle.subscribe,
    lifecycle.getSnapshot,
    lifecycle.getSnapshot,
  );
  const [view, setView] = useState<ViewState>(() => initial(scope.generation));
  const [boundGeneration, setBoundGeneration] = useState<number | null>(null);
  const boundRef = useRef<number | null>(null);
  const bindForm = useCallback((generation: number | null) => {
    boundRef.current = generation;
    setBoundGeneration(generation);
  }, []);
  const active = useRef(true);
  const operationLock = useRef(false);
  const operationToken = useRef(0);
  const invalidateOperation = useCallback(() => {
    ++operationToken.current;
  }, []);
  const { reset, trigger, getValues } = form;
  const clearForm = useCallback(
    () =>
      reset({
        title: '',
        exercises: [{ exerciseId: '', sets: [{ reps: '10', weightKg: '' }] }],
      }),
    [reset],
  );

  const renderedToken = operationToken.current;
  const ready = scope.status === 'ready';
  const current = view.generation === scope.generation ? view : initial(scope.generation);
  const hideForm = boundGeneration !== null && (!ready || boundGeneration !== scope.generation);
  const isCurrent = (generation: number, token: number) => {
    const latest = lifecycle.getSnapshot();
    return (
      active.current &&
      token === operationToken.current &&
      latest.status === 'ready' &&
      latest.generation === generation
    );
  };

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      invalidateOperation();
    };
  }, [invalidateOperation]);

  useEffect(
    () =>
      lifecycle.subscribe(() => {
        const latest = lifecycle.getSnapshot();
        if (
          boundRef.current !== null &&
          (latest.status !== 'ready' || boundRef.current !== latest.generation)
        ) {
          clearForm();
          bindForm(null);
        }
      }),
    [bindForm, clearForm, lifecycle],
  );

  useEffect(() => {
    const token = ++operationToken.current;
    operationLock.current = false;
    if (!ready) return;
    const generation = scope.generation;
    void lifecycle.load().then(
      (draft) => {
        if (
          !active.current ||
          operationToken.current !== token ||
          lifecycle.getSnapshot().generation !== generation ||
          lifecycle.getSnapshot().status !== 'ready'
        )
          return;
        setView({ generation, presence: presenceOf(draft), feedback: null, pending: null });
      },
      () => {
        if (
          !active.current ||
          operationToken.current !== token ||
          lifecycle.getSnapshot().generation !== generation ||
          lifecycle.getSnapshot().status !== 'ready'
        )
          return;
        setView({ generation, presence: 'error', feedback: 'failed', pending: null });
      },
    );
    return invalidateOperation;
  }, [invalidateOperation, lifecycle, ready, scope.generation]);

  const pending = current.pending !== null;
  const checking = ready && current.presence === 'checking';
  const busy = pending || checking;
  const canOperate = ready && !busy && !hideForm;
  const canSave =
    canOperate &&
    (current.presence === 'none' ||
      (current.presence === 'exists' && boundGeneration === scope.generation));
  const canRestore =
    canOperate && (current.presence === 'exists' || current.presence === 'submission-pending');
  const canDiscard =
    canOperate &&
    (current.presence === 'exists' ||
      current.presence === 'error' ||
      (current.presence === 'none' && boundGeneration !== null));
  const canRetry = canOperate && current.presence === 'error';
  const canSend =
    canOperate &&
    submission.allowed &&
    submission.online &&
    boundGeneration === scope.generation &&
    (current.presence === 'exists' || current.presence === 'submission-pending');
  const canClear = canOperate && submission.allowed && current.presence === 'acknowledged';
  const readOnly = current.presence === 'submission-pending' || current.presence === 'acknowledged';

  // Imperative guard is rechecked both before validation and before the POST.
  // While checking existing storage, never race a normal submission.
  const blocksSubmission = () => {
    const latest = lifecycle.getSnapshot();
    if (
      latest.generation !== scope.generation ||
      operationToken.current !== renderedToken ||
      operationLock.current ||
      hideForm ||
      boundGeneration !== null
    )
      return true;
    if (latest.status === 'preparing') return true;
    if (latest.status === 'ready') {
      return latest.generation !== view.generation || current.presence !== 'none';
    }
    return false;
  };

  const run = async (operation: Operation, expectedGeneration: number, reviewedBody?: string) => {
    const latest = lifecycle.getSnapshot();
    if (
      !active.current ||
      operationToken.current !== renderedToken ||
      operationLock.current ||
      submissionLock.current ||
      submissionAttempted.current ||
      latest.status !== 'ready' ||
      latest.generation !== expectedGeneration ||
      expectedGeneration !== scope.generation ||
      !canOperate
    )
      return;
    if (operation === 'save' && !canSave) return;
    if (operation === 'restore' && !canRestore) return;
    if (operation === 'discard' && !canDiscard) return;
    if (operation === 'check' && !canRetry) return;
    if (operation === 'send' && !canSend) return;
    if (operation === 'clear' && !canClear) return;
    operationLock.current = true;
    const token = ++operationToken.current;
    setView({ ...current, pending: operation, feedback: null });
    try {
      if (operation === 'save') {
        const valid = await trigger();
        if (!isCurrent(expectedGeneration, token)) return;
        const parsed = mobileMultiWorkoutFormSchema.safeParse(getValues());
        if (!valid || !parsed.success) {
          setView({ ...current, pending: null, feedback: 'invalid' });
          return;
        }
        // Bind before writing: an uncertain or interrupted save remains local-only.
        bindForm(expectedGeneration);
        await lifecycle.save(parsed.data);
        if (!isCurrent(expectedGeneration, token)) return;
        setView({
          generation: expectedGeneration,
          presence: 'exists',
          pending: null,
          feedback: 'saved',
        });
      } else if (operation === 'restore') {
        const draft = await lifecycle.load();
        if (!isCurrent(expectedGeneration, token)) return;
        if (draft && draft.state !== 'SUBMISSION_ACKNOWLEDGED') {
          reset(draft.form, { keepDefaultValues: true });
          bindForm(expectedGeneration);
        }
        setView({
          generation: expectedGeneration,
          presence: presenceOf(draft),
          pending: null,
          feedback: draft ? 'restored' : null,
        });
      } else if (operation === 'discard') {
        await lifecycle.discard();
        if (!isCurrent(expectedGeneration, token)) return;
        // Discarding a bound draft must not silently turn it into a fresh POST.
        if (boundGeneration !== null) clearForm();
        bindForm(null);
        setView({
          generation: expectedGeneration,
          presence: 'none',
          pending: null,
          feedback: 'discarded',
        });
      } else if (operation === 'send') {
        const valid = await trigger();
        if (!isCurrent(expectedGeneration, token)) return;
        const parsed = mobileMultiWorkoutFormSchema.safeParse(getValues());
        if (!valid || !parsed.success || draftBodyJson(parsed.data) !== reviewedBody) {
          setView({ ...current, pending: null, feedback: 'invalid' });
          return;
        }
        await submission.send(parsed.data, expectedGeneration);
        if (!isCurrent(expectedGeneration, token)) return;
        clearForm();
        bindForm(null);
        setView({
          generation: expectedGeneration,
          presence: 'acknowledged',
          pending: null,
          feedback: 'sent',
        });
      } else if (operation === 'clear') {
        await submission.clear(expectedGeneration);
        if (!isCurrent(expectedGeneration, token)) return;
        clearForm();
        bindForm(null);
        setView({
          generation: expectedGeneration,
          presence: 'none',
          pending: null,
          feedback: 'cleared',
        });
      } else {
        const draft = await lifecycle.load();
        if (!isCurrent(expectedGeneration, token)) return;
        setView({
          generation: expectedGeneration,
          presence: presenceOf(draft),
          pending: null,
          feedback: null,
        });
      }
    } catch {
      if (isCurrent(expectedGeneration, token)) {
        // Read only after ambiguous send/cleanup. Never retry the POST automatically.
        let presence: DraftPresence = operation === 'clear' ? 'acknowledged' : 'error';
        if (operation === 'send') {
          try {
            presence = presenceOf(await lifecycle.load());
          } catch {
            /* stay blocked */
          }
        }
        if (!isCurrent(expectedGeneration, token)) return;
        if (presence === 'acknowledged') {
          clearForm();
          bindForm(null);
        }
        setView({
          generation: expectedGeneration,
          presence,
          pending: null,
          feedback:
            operation === 'send' ? 'sendFailed' : operation === 'clear' ? 'clearFailed' : 'failed',
        });
      }
    } finally {
      if (operationToken.current === token) operationLock.current = false;
    }
  };

  return {
    scope,
    presence: current.presence,
    feedback: current.feedback,
    busy,
    hideForm,
    bound: boundGeneration !== null,
    canSave,
    canRestore,
    canDiscard,
    canRetry,
    canSend,
    canClear,
    readOnly,
    online: submission.online,
    blocksSubmission,
    confirmSend: () => {
      let reviewedBody: string;
      try {
        reviewedBody = draftBodyJson(getValues());
      } catch {
        return () => Promise.resolve();
      }
      return () => run('send', scope.generation, reviewedBody);
    },
    clear: () => run('clear', scope.generation),
    save: () => run('save', scope.generation),
    restore: () => run('restore', scope.generation),
    discard: () => run('discard', scope.generation),
    retry: () => run('check', scope.generation),
  };
}
