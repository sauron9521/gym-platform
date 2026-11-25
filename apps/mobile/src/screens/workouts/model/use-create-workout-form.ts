import { useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  mobileMultiWorkoutFormSchema,
  type MobileMultiWorkoutForm,
} from '@/features/workouts/lib/create-workout-schema';
import { useCreateMultiMobileWorkout } from '@/features/workouts/model/workout-create';

/** Screen-local form orchestration; mutation owns request idempotency. */
export function useCreateWorkoutForm() {
  const router = useRouter();
  const createWorkout = useCreateMultiMobileWorkout();
  const submitLock = useRef(false);
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
  const disabled = isSubmitting || createWorkout.isPending;

  const onValidSubmit = async (values: MobileMultiWorkoutForm) => {
    // React state may not update between repeated presses.
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      await createWorkout.mutateAsync(values);
      router.back();
    } catch {
      // Preserve form values for correction or an idempotent manual retry.
    } finally {
      submitLock.current = false;
    }
  };

  const submit = () => void handleSubmit(onValidSubmit)();
  return { form, control, errors, fields, append, remove, disabled, createWorkout, submit };
}
