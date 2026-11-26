import { QueryClient } from '@tanstack/react-query';

/** Scope authenticated resources by account ID. Never include credentials in query keys. */
export const accountQueryKeys = {
  all: ['account'] as const,
  me: (userId: string) => ['account', 'me', userId] as const,
  workoutPreferences: (userId: string) => ['account', 'workout-preferences', userId] as const,
  workouts: (userId: string) => ['account', 'workouts', userId] as const,
  workoutDetail: (userId: string, workoutId: string) =>
    ['account', 'workout', userId, workoutId] as const,
  // Separate GET-only proof: ordinary setQueryData/PATCH responses must not
  // be mistaken for successful canonical reconciliation.
  workoutDetailRead: (userId: string, workoutId: string) =>
    ['account', 'workout-read', userId, workoutId] as const,
};

export function createMobileQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
