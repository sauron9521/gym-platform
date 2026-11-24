import type { Prisma, Role, TrainerAthleteStatus } from '#prisma/client';

export type TrainerAthleteActor = {
  id: string;
  role: Role;
};

export type CreateTrainerAthleteInput = {
  userId: string;
};

export type TrainerAthleteListQuery = {
  page: number;
  limit: number;
  status?: TrainerAthleteStatus;
  scope?: 'trainer';
};

export type TerminateTrainerAthleteInput = {
  reason?: string | null;
};

export type FindManyTrainerAthletesParams = {
  where: Prisma.TrainerAthleteWhereInput;
  skip: number;
  take: number;
  orderBy?: Prisma.TrainerAthleteOrderByWithRelationInput[];
};
