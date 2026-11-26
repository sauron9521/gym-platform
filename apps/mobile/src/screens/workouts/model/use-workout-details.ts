import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useStore } from 'zustand';
import { Alert } from 'react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { canCompleteWorkout, workoutSetProgress } from '@gym/domain';
import { useAppSettings } from '@/features/app-settings/model/app-settings-context';
import { useCancelWorkout, useUpdateWorkoutTitle } from '@/features/workouts/model/workout-edit';
import {
  useWorkoutDetailsQuery,
  useWorkoutTransition,
  type WorkoutTransition,
  type WorkoutDetails,
} from '@/features/workouts/model/workout-details-query';
import { useWorkoutKeepAwake } from '@/features/workouts/lib/use-workout-keep-awake';
import { useRestTimerStore } from '@/features/workouts/model/rest-timer-provider';

/** Screen-scoped orchestration: coordinate set writes, workout actions and rest events. */
export function useWorkoutDetails(id: string) {
  const accountId = useAppSettings((state) => state.settings.accountId);
  const restDuration = useAppSettings((state) => state.settings.restDuration);
  const keepWorkoutScreenAwake = useAppSettings((state) => state.settings.keepWorkoutScreenAwake);
  const shouldAutoStartRestTimer = useAppSettings((state) => state.shouldAutoStartRestTimer);
  const confirmWorkoutCompletion = useAppSettings(
    (state) => state.settings.confirmWorkoutCompletion,
  );
  const details = useWorkoutDetailsQuery(id);
  const transition = useWorkoutTransition(id);
  const titleUpdate = useUpdateWorkoutTitle(id);
  const cancellation = useCancelWorkout(id);
  const writeLock = useRef(false);
  const setWriteLock = useRef<string | null>(null);
  const requiredRead = useRef<number | null>(null);
  const [pendingSet, setPendingSet] = useState<string | null>(null);
  const [requiredReadVersion, setRequiredReadVersion] = useState<number | null>(null);
  const [actionLocked, setActionLocked] = useState(false);
  const editingSets = useRef(new Set<string>());
  const [openEdits, setOpenEdits] = useState<ReadonlySet<string>>(() => new Set());
  const [review, setReview] = useState<{
    accountId: string;
    workoutId: string;
    snapshot: WorkoutDetails;
    readVersion: number;
    updatedAt: number;
    current: () => boolean;
  } | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!accountId || !id) return;
      const unsubscribeOnline = onlineManager.subscribe((online) => {
        if (!online) setReview(null);
      });
      const unsubscribeFocus = focusManager.subscribe((focused) => {
        if (!focused) setReview(null);
      });
      return () => {
        unsubscribeOnline();
        unsubscribeFocus();
        setReview(null);
      };
    }, [accountId, id]),
  );
  const workout = details.data;
  const restStore = useRestTimerStore();
  const restScope = useStore(restStore, (state) =>
    state.timer?.scope.workoutId === id ? state.timer.scope : null,
  );
  const active = Boolean(accountId && !details.isError && workout?.status === 'IN_PROGRESS');
  useFocusEffect(
    useCallback(() => {
      if (active) restStore.getState().selectWorkout(id, restDuration);
    }, [active, id, restStore, restDuration]),
  );
  useEffect(() => {
    if (workout && !details.isError && workout.status !== 'IN_PROGRESS') {
      restStore.getState().clearWorkout(id);
    }
  }, [details.isError, id, restStore, workout]);

  useWorkoutKeepAwake(
    Boolean(
      accountId && keepWorkoutScreenAwake && !details.isError && workout?.status === 'IN_PROGRESS',
    ),
  );
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
  const beginSetEdit = useCallback((setId: string) => {
    if (writeLock.current || setWriteLock.current !== null) return false;
    editingSets.current.add(setId);
    setOpenEdits(new Set(editingSets.current));
    setReview(null);
    return true;
  }, []);
  const endSetEdit = useCallback((setId: string) => {
    if (editingSets.current.delete(setId)) setOpenEdits(new Set(editingSets.current));
  }, []);
  const beginSetWrite = (setId: string) => {
    if (writeLock.current || actionBusy || setWritesBlocked() || workout?.status !== 'IN_PROGRESS')
      return false;
    setReview(null);
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
    if (!restScope || !shouldAutoStartRestTimer()) return;
    restStore.getState().start(restScope, Date.now());
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
    setReview(null);
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

  const editBlocked = openEdits.size > 0;
  const actionDisabled = busy || (nextAction === 'complete' && (!completionAllowed || editBlocked));
  const reviewCurrent = Boolean(
    review &&
    confirmWorkoutCompletion !== false &&
    !actionDisabled &&
    !details.isError &&
    nextAction === 'complete' &&
    review.accountId === accountId &&
    review.workoutId === id &&
    review.snapshot === workout &&
    review.readVersion === readVersion &&
    review.updatedAt === details.dataUpdatedAt,
  );
  // A changed authoritative view invalidates the old consent, even if all sets
  // happen to be completed again later.
  if (review && !reviewCurrent) setReview(null);

  const submit = (action: WorkoutTransition, canSend?: () => boolean) => {
    writeLock.current = true;
    setActionLocked(true);
    setReview(null);
    transition.mutate(action, { onSettled: releaseLock, canSend });
  };
  const mayTransition = () =>
    Boolean(
      nextAction &&
      !details.isError &&
      !writeLock.current &&
      !setWritesBlocked() &&
      !actionDisabled,
    );
  const runTransition = () => {
    if (!mayTransition() || !nextAction) return;
    if (nextAction === 'start') {
      submit('start');
      return;
    }
    if (!accountId || !workout || editingSets.current.size || !onlineManager.isOnline()) return;
    const current = details.captureCompletionGuard();
    if (!current()) return;
    if (confirmWorkoutCompletion !== false) {
      setReview({
        accountId,
        workoutId: id,
        snapshot: workout,
        readVersion,
        updatedAt: details.dataUpdatedAt,
        current,
      });
    } else {
      submit('complete', current);
    }
  };
  const confirmCompletion = () => {
    if (
      !reviewCurrent ||
      !review ||
      !mayTransition() ||
      editingSets.current.size ||
      !onlineManager.isOnline() ||
      !review.current()
    ) {
      setReview(null);
      return;
    }
    submit('complete', review.current);
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
    nextAction,
    actionDisabled,
    editBlocked,
    openEdits,
    reviewCurrent,
    confirmCompletion,
    cancelCompletion: () => setReview(null),
    beginSetEdit,
    endSetEdit,
    saveTitle,
    confirmCancellation,
    runTransition,
    isSetActionBlocked,
    beginSetWrite,
    settleSetWrite,
    startRest,
  };
}
