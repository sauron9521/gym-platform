import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  mobileMultiWorkoutFormSchema,
  type MobileMultiWorkoutForm,
} from '@/features/workouts/lib/create-workout-schema';
import { useCreateMultiMobileWorkout } from '@/features/workouts/model/workout-create';
import type { OfflineDraftLifecycle } from '@/features/workouts/model/offline-draft-lifecycle';
import { useWorkoutDraftForm } from './use-workout-draft-form';

/** Screen-local form orchestration; mutation owns request idempotency. */
export function useCreateWorkoutForm(lifecycle?: OfflineDraftLifecycle) {
  const router = useRouter();
  const createWorkout = useCreateMultiMobileWorkout();
  const submitLock = useRef(false);
  const attempted = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [submissionStarted, setSubmissionStarted] = useState(false);
  const form = useForm<MobileMultiWorkoutForm>({
    resolver: zodResolver(mobileMultiWorkoutFormSchema),
    defaultValues: {
      title: '',
      exercises: [{ exerciseId: '', sets: [{ reps: '10', weightKg: '' }] }],
    },
  });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'exercises' });
  const draft = useWorkoutDraftForm(form, submitLock, attempted, lifecycle);
  const disabled = isSubmitting || createWorkout.isPending || draft.busy;

  const onValidSubmit = async (values: MobileMultiWorkoutForm) => {
    if (!active.current || draft.blocksSubmission()) return;
    attempted.current = true;
    setSubmissionStarted(true);
    try {
      await createWorkout.mutateAsync(values);
      if (active.current) router.back();
    } catch {
      // Preserve form values for correction or an idempotent manual retry.
    }
  };

  const submit = () => {
    // Acquire before asynchronous RHF validation, not only before mutation.
    if (submitLock.current || draft.blocksSubmission()) return;
    submitLock.current = true;
    void handleSubmit(onValidSubmit)().finally(() => {
      submitLock.current = false;
    });
  };
  return {
    form,
    control,
    errors,
    fields,
    append,
    remove,
    disabled,
    createWorkout,
    submit,
    draft,
    submissionStarted,
  };
}
