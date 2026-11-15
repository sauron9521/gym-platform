import type { ExerciseTypeFilter } from './exercise-catalog';

export type ExerciseCatalogFilters = {
  search: string;
  exerciseType: ExerciseTypeFilter;
  muscleGroup: string;
  equipment: string;
  page: number;
};

export function normalizeExerciseCatalogFilters(filters: ExerciseCatalogFilters) {
  return {
    ...filters,
    search: filters.search.trim(),
    muscleGroup: filters.muscleGroup.trim(),
    equipment: filters.equipment.trim(),
  };
}

export const exerciseQueryKeys = {
  all: ['exercises'] as const,
  lists: () => [...exerciseQueryKeys.all, 'list'] as const,
  list: (filters: ExerciseCatalogFilters) =>
    [...exerciseQueryKeys.lists(), normalizeExerciseCatalogFilters(filters)] as const,
};
