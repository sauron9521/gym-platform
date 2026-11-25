import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { canCompleteWorkout, workoutSetProgress } from '@gym/domain';
import { useAppSettings } from '@/features/app-settings/model/app-settings-context';
import { useCancelWorkout, useUpdateWorkoutTitle } from '@/features/workouts/model/workout-edit';
import {
  useWorkoutDetailsQuery,
  useWorkoutTransition,
  type WorkoutTransition,
} from '@/features/workouts/model/workout-details-query';
import type { RestStart } from '@/features/workouts/ui/rest-timer';

/** Screen-scoped orchestration: coordinate set writes, workout actions and rest events. */
export function useWorkoutDetails(id: string) {
  const { shouldAutoStartRestTimer } = useAppSettings();
  const details = useWorkoutDetailsQuery(id);
  const transition = useWorkoutTransition(id);
  const titleUpdate = useUpdateWorkoutTitle(id);
  const cancellation = useCancelWorkout(id);
  const writeLock = useRef(false);
  const setWriteLock = useRef<string | null>(null);
  const requiredRead = useRef<number | null>(null);
  const [pendingSet, setPendingSet] = useState<string | null>(null);
  const [requiredReadVersion, setRequiredReadVersion] = useState<number | null>(null);
  const [restStart, setRestStart] = useState<RestStart | null>(null);
  const [actionLocked, setActionLocked] = useState(false);
  const workout = details.data;
  const allSets = workout?.exercises.flatMap((exercise) => exercise.sets) ?? [];
  const progress = workoutSetProgress(allSets);
  const completionAllowed = canCompleteWorkout(allSets);
  const reconciling = details.isFetching && !details.isPending;
  const readVersion = details.canonicalReadVersion ?? 0;
  const uncertain = requiredReadVersion !== null && readVersion <= requiredReadVersion;
  const actionBusy =
    transition.isPending ||
    titleUpdate.isPending ||
    cancellation.isPending ||
    actionLocked ||
    reconciling;
  const busy = actionBusy || pendingSet !== null || uncertain;
  const setWritesBlocked = () =>
    setWriteLock.current !== null ||
    (requiredRead.current !== null && readVersion <= requiredRead.current);
  const beginSetWrite = (setId: string) => {
    if (writeLock.current || actionBusy || setWritesBlocked() || workout?.status !== 'IN_PROGRESS')
      return false;
    setWriteLock.current = setId;
    setPendingSet(setId);
    return true;
  };
  const settleSetWrite = (setId: string, required: number | null) => {
    if (setWriteLock.current !== setId) return;
    requiredRead.current = required;
    setRequiredReadVersion(required);
    setWriteLock.current = null;
    setPendingSet(null);
  };
  const startRest = () => {
    if (!shouldAutoStartRestTimer()) return;
    const startedAt = Date.now();
    setRestStart((previous) => ({ sequence: (previous?.sequence ?? 0) + 1, startedAt }));
  };
  const total = allSets.length;
  const processed = progress.completed + progress.skipped;
  const percent = total ? Math.round((processed / total) * 100) : 0;
  const cancellable = workout?.status === 'PLANNED' || workout?.status === 'IN_PROGRESS';
  const releaseLock = () => {
    writeLock.current = false;
    setActionLocked(false);
  };

  const saveTitle = (title: string) => {
    if (writeLock.current || setWritesBlocked() || busy || workout?.status !== 'PLANNED') return;
    writeLock.current = true;
    setActionLocked(true);
    titleUpdate.mutate(title, { onSettled: releaseLock });
  };

  const confirmCancellation = () => {
    if (writeLock.current || setWritesBlocked() || busy || !cancellable) return;
    writeLock.current = true;
    setActionLocked(true);
    Alert.alert(
      'Скасувати тренування?',
      'Цю дію не можна скасувати.',
      [
        {
          text: 'Назад',
          style: 'cancel',
          onPress: releaseLock,
        },
        {
          text: 'Скасувати тренування',
          style: 'destructive',
          onPress: () => {
            cancellation.mutate(undefined, {
              onSettled: releaseLock,
            });
          },
        },
      ],
      { cancelable: false },
    );
  };
  const nextAction: WorkoutTransition | null =
    workout?.status === 'PLANNED' ? 'start' : workout?.status === 'IN_PROGRESS' ? 'complete' : null;

  const actionDisabled = busy || (nextAction === 'complete' && !completionAllowed);
  const runTransition = () => {
    if (!nextAction || writeLock.current || setWritesBlocked() || actionDisabled) return;
    writeLock.current = true;
    setActionLocked(true);
    transition.mutate(nextAction, { onSettled: releaseLock });
  };
  const isSetActionBlocked = (setId: string) =>
    actionBusy || (pendingSet !== null && pendingSet !== setId) || uncertain;

  return {
    details,
    transition,
    titleUpdate,
    cancellation,
    workout,
    progress,
    total,
    processed,
    percent,
    completionAllowed,
    reconciling,
    busy,
    pendingSet,
    uncertain,
    restStart,
    nextAction,
    actionDisabled,
    saveTitle,
    confirmCancellation,
    runTransition,
    isSetActionBlocked,
    beginSetWrite,
    settleSetWrite,
    startRest,
  };
}
