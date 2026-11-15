'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import {
  exerciseTaxonomyQueryOptions,
  ExerciseTaxonomyRequestError,
} from '../api/exercise-taxonomy-query';
import { getTaxonomyErrorMessage, type ExerciseTaxonomyState } from '../lib/exercise-taxonomy';

export function useExerciseTaxonomy() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const redirecting = useRef(false);
  const query = useQuery(exerciseTaxonomyQueryOptions());
  const unauthenticated =
    query.error instanceof ExerciseTaxonomyRequestError && query.error.status === 401;

  useEffect(() => {
    if (unauthenticated && !redirecting.current) {
      redirecting.current = true;
      queryClient.clear();
      router.replace('/login');
    }
  }, [unauthenticated, queryClient, router]);

  const state: ExerciseTaxonomyState = query.isPending || unauthenticated
    ? { kind: 'loading' }
    : query.isError
      ? {
          kind: 'error',
          message:
            query.error instanceof ExerciseTaxonomyRequestError
              ? query.error.message
              : getTaxonomyErrorMessage(),
        }
      : {
          kind: 'ready',
          muscleGroups: query.data.muscleGroups,
          equipment: query.data.equipment,
        };

  function retry() {
    void query.refetch();
  }

  return { state, retry };
}
