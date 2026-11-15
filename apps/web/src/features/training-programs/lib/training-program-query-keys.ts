import type { ProgramStatusFilter } from './training-programs-list';

export const trainingProgramQueryKeys = {
  all: ['training-programs'] as const,
  lists: () => [...trainingProgramQueryKeys.all, 'list'] as const,
  list: (status: ProgramStatusFilter, page: number) =>
    [...trainingProgramQueryKeys.lists(), { status, page }] as const,
};
