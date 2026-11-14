'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';
import { getTaxonomyErrorMessage, type ExerciseTaxonomyState } from '../lib/exercise-taxonomy';

export function useExerciseTaxonomy() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ExerciseTaxonomyState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void Promise.all([
      webApi.GET('/exercises/muscle-groups'),
      webApi.GET('/exercises/equipment'),
    ])
      .then(([muscles, equipment]) => {
        if (!active) return;

        if (muscles.response.status === 401 || equipment.response.status === 401) {
          router.replace('/login');
          return;
        }

        if (
          muscles.response.status !== 200 ||
          equipment.response.status !== 200 ||
          !muscles.data ||
          !equipment.data
        ) {
          const status = muscles.response.status !== 200 ? muscles.response.status : equipment.response.status;
          setState({ kind: 'error', message: getTaxonomyErrorMessage(status) });
          return;
        }

        setState({
          kind: 'ready',
          muscleGroups: muscles.data,
          equipment: equipment.data,
        });
      })
      .catch(() => {
        if (active) setState({ kind: 'error', message: getTaxonomyErrorMessage() });
      });

    return () => {
      active = false;
    };
  }, [attempt, router]);

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((current) => current + 1);
  }

  return { state, retry };
}
