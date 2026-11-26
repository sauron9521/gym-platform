import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';

import {
  workoutSetFormSchema,
  workoutSetPayload,
  type WorkoutSetFormValues,
} from '../lib/workout-set-form';
import type { WorkoutDetails } from './workout-details-query';
import {
  WorkoutSetRateLimitError,
  WorkoutSetOutcomeUnknownError,
  useWorkoutSetMutation,
} from './workout-set-mutation';

type WorkoutSet = WorkoutDetails['exercises'][number]['sets'][number];

export type WorkoutSetRowOptions = {
  workoutId: string;
  set: WorkoutSet;
  editable: boolean;
  reconciling?: boolean;
  canonicalSnapshotAt?: number;
  canonicalReadVersion?: number;
  actionBlocked?: boolean;
  onWriteStart?: (setId: string) => boolean;
  onWriteSettled?: (setId: string, requiredReadVersion: number | null) => void;
  onNewCompletion?: () => void;
  onEditStart?: (setId: string) => boolean;
  onEditEnd?: (setId: string) => void;
};

export function useWorkoutSetRow({
  workoutId,
  set,
  editable,
  reconciling = false,
  canonicalSnapshotAt,
  canonicalReadVersion = 0,
  actionBlocked = false,
  onWriteStart,
  onWriteSettled,
  onNewCompletion,
  onEditStart,
  onEditEnd,
}: WorkoutSetRowOptions) {
  const mutation = useWorkoutSetMutation(workoutId);
  const submitLock = useRef(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState<'complete' | 'skip' | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  // A lost response must not unlock another PATCH before a later canonical GET.
  const [unverifiedReadVersion, setUnverifiedReadVersion] = useState<number | null>(null);
  // A PATCH response is authoritative even if the details query has no cache yet.
  // Once a newer server snapshot arrives, use it instead of the local acknowledgment.
  const [confirmedResult, setConfirmedResult] = useState<{
    previousUpdatedAt: string;
    snapshotAt?: number;
    set: WorkoutSet;
  } | null>(null);
  // Read-only canonical GET snapshots supersede a local PATCH acknowledgment,
  // including a server PENDING reply with the same set updatedAt timestamp.
  const visibleSet =
    confirmedResult?.set.id === set.id &&
    confirmedResult.previousUpdatedAt === set.updatedAt &&
    confirmedResult.snapshotAt === canonicalSnapshotAt
      ? confirmedResult.set
      : set;
  useEffect(() => () => onEditEnd?.(set.id), [onEditEnd, set.id]);

  const isSaved = visibleSet.status !== 'PENDING';
  const isEditing = !isSaved || editing;
  const limited = retryAt !== null;
  const uncertainWriteUnverified =
    unverifiedReadVersion !== null && canonicalReadVersion <= unverifiedReadVersion;
  const writingBlocked = reconciling || uncertainWriteUnverified || actionBlocked;
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkoutSetFormValues>({
    resolver: zodResolver(workoutSetFormSchema),
    defaultValues: {
      actualReps: String(set.actualReps ?? set.plannedReps ?? ''),
      actualWeightKg: String(set.actualWeightKg ?? set.plannedWeightKg ?? ''),
    },
  });

  useEffect(() => {
    reset({
      actualReps: String(visibleSet.actualReps ?? visibleSet.plannedReps ?? ''),
      actualWeightKg: String(visibleSet.actualWeightKg ?? visibleSet.plannedWeightKg ?? ''),
    });
  }, [
    reset,
    visibleSet.actualReps,
    visibleSet.actualWeightKg,
    visibleSet.plannedReps,
    visibleSet.plannedWeightKg,
  ]);

  useEffect(() => {
    if (retryAt === null) return;
    const timeout = setTimeout(() => setRetryAt(null), Math.max(0, retryAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [retryAt]);

  const captureWriteFailure = (error: unknown, previousSnapshotAt: number) => {
    captureRateLimit(error);
    if (error instanceof WorkoutSetOutcomeUnknownError && !error.canonicalStateVerified) {
      const required = Math.max(previousSnapshotAt, error.readVersionAtFailure);
      setUnverifiedReadVersion(required);
      return required;
    }
    return null;
  };

  const captureRateLimit = (error: unknown) => {
    if (error instanceof WorkoutSetRateLimitError) {
      setRetryAt(Date.now() + error.retryAfterSeconds * 1000);
    }
  };

  const saveCompleted = async () => {
    // Lock immediately, before asynchronous validation or mutation state updates.
    if (
      submitLock.current ||
      mutation.isPending ||
      !editable ||
      !isEditing ||
      limited ||
      writingBlocked
    )
      return;
    if (onWriteStart && !onWriteStart(set.id)) return;
    submitLock.current = true;
    setSubmitting('complete');
    const before = canonicalReadVersion;
    let requiredReadVersion: number | null = null;
    try {
      await handleSubmit(async (values) => {
        Keyboard.dismiss();
        const updated = await mutation.mutateAsync({
          setId: set.id,
          body: workoutSetPayload(values),
        });
        setConfirmedResult({
          previousUpdatedAt: set.updatedAt,
          snapshotAt: canonicalSnapshotAt,
          set: updated,
        });
        setEditing(false);
        onEditEnd?.(set.id);
        if (visibleSet.status === 'PENDING' && updated.status === 'COMPLETED') {
          onNewCompletion?.();
        }
      })();
    } catch (error) {
      requiredReadVersion = captureWriteFailure(error, before);
    } finally {
      submitLock.current = false;
      setSubmitting(null);
      onWriteSettled?.(set.id, requiredReadVersion);
    }
  };

  const skipSet = async () => {
    if (
      submitLock.current ||
      mutation.isPending ||
      !editable ||
      !isEditing ||
      limited ||
      writingBlocked
    )
      return;
    if (onWriteStart && !onWriteStart(set.id)) return;
    submitLock.current = true;
    setSubmitting('skip');
    const before = canonicalReadVersion;
    let requiredReadVersion: number | null = null;
    try {
      Keyboard.dismiss();
      const updated = await mutation.mutateAsync({ setId: set.id, body: { status: 'SKIPPED' } });
      setConfirmedResult({
        previousUpdatedAt: set.updatedAt,
        snapshotAt: canonicalSnapshotAt,
        set: updated,
      });
      setEditing(false);
      onEditEnd?.(set.id);
    } catch (error) {
      requiredReadVersion = captureWriteFailure(error, before);
    } finally {
      submitLock.current = false;
      setSubmitting(null);
      onWriteSettled?.(set.id, requiredReadVersion);
    }
  };

  const saving = submitting !== null || mutation.isPending || isSubmitting;
  const savingDisabled = !editable || saving || limited || writingBlocked;

  const cancelEditing = () => {
    reset({
      actualReps: String(visibleSet.actualReps ?? visibleSet.plannedReps ?? ''),
      actualWeightKg: String(visibleSet.actualWeightKg ?? visibleSet.plannedWeightKg ?? ''),
    });
    setEditing(false);
    onEditEnd?.(set.id);
  };
  const errorMessage = mutation.isError
    ? mutation.error instanceof WorkoutSetOutcomeUnknownError &&
      (mutation.error.canonicalStateVerified ||
        (unverifiedReadVersion !== null && !uncertainWriteUnverified))
      ? 'Стан отримано із сервера. Перевірте підхід перед новою дією.'
      : mutation.error.message
    : null;

  return {
    visibleSet,
    isSaved,
    isEditing,
    editing,
    submitting,
    limited,
    uncertainWriteUnverified,
    writingBlocked,
    saving,
    savingDisabled,
    control,
    errors,
    saveCompleted,
    skipSet,
    beginEditing: () => {
      if (!editable || !isSaved || savingDisabled || (onEditStart && !onEditStart(set.id))) return;
      setEditing(true);
    },
    cancelEditing,
    errorMessage,
  };
}
