'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { operations } from '@gym/api-client';

import { webApi } from '@/shared/api/client';

export type TaxonomyItem =
  operations['ExerciseTaxonomyController_findMuscleGroups']['responses'][200]['content']['application/json'][number];

type TaxonomyState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; muscles: TaxonomyItem[]; equipment: TaxonomyItem[] };

export function useExerciseTaxonomy() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<TaxonomyState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void Promise.all([
      webApi.GET('/exercise-taxonomy/muscle-groups'),
      webApi.GET('/exercise-taxonomy/equipment'),
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
          setState({ kind: 'error' });
          return;
        }
        setState({ kind: 'ready', muscles: muscles.data, equipment: equipment.data });
      })
      .catch(() => {
        if (active) setState({ kind: 'error' });
      });

    return () => {
      active = false;
    };
  }, [attempt, router]);

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  return { state, retry };
}
