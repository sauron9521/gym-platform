import type { TrainerAthleteFilter } from './trainer-athletes-list';

export type RelationshipActorRole = 'TRAINER' | 'ATHLETE';

export const trainerAthleteQueryKeys = {
  all: ['trainer-athletes'] as const,
  lists: () => [...trainerAthleteQueryKeys.all, 'list'] as const,
  list: (actorId: string, actorRole: RelationshipActorRole, filter: TrainerAthleteFilter, page: number) =>
    [...trainerAthleteQueryKeys.lists(), { actorId, actorRole, filter, page }] as const,
};
