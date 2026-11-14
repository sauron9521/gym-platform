import type { operations } from '@gym/api-client';

type ProgramListResponse =
  operations['TrainingProgramsController_findMany']['responses'][200]['content']['application/json'];
type AssignmentListResponse =
  operations['TrainingProgramAssignmentsController_findManyAssignments']['responses'][200]['content']['application/json'];

export type TrainingProgramItem = ProgramListResponse['data'][number];
export type TrainingProgramVersionItem = TrainingProgramItem['versions'][number];
export type TrainingAssignmentItem = AssignmentListResponse['data'][number];

export type ProgramStatus = TrainingProgramItem['status'];
export type AssignmentStatus = TrainingAssignmentItem['status'];

export type ProgramStatusFilter = ProgramStatus | 'ALL';
export type AssignmentStatusFilter = AssignmentStatus | 'ALL';

export const PROGRAM_STATUSES: ReadonlyArray<{ value: ProgramStatusFilter; label: string }> = [
  { value: 'ALL', label: 'Усі статуси' },
  { value: 'DRAFT', label: 'Чернетки' },
  { value: 'PUBLISHED', label: 'Опубліковані' },
  { value: 'ARCHIVED', label: 'Архівні' },
];

export const ASSIGNMENT_STATUSES: ReadonlyArray<{
  value: AssignmentStatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'Усі призначення' },
  { value: 'ACTIVE', label: 'Активні' },
  { value: 'COMPLETED', label: 'Виконані' },
  { value: 'CANCELLED', label: 'Скасовані' },
  { value: 'TERMINATED', label: 'Завершені' },
];

export function getProgramStatusLabel(status: ProgramStatus): string {
  return PROGRAM_STATUSES.find((item) => item.value === status)?.label ?? 'Невідомий статус';
}

export function getAssignmentStatusLabel(status: AssignmentStatus): string {
  return ASSIGNMENT_STATUSES.find((item) => item.value === status)?.label ?? 'Невідомий статус';
}

export function getProgramVersionStatusLabel(status: TrainingProgramVersionItem['status']): string {
  return status === 'DRAFT' ? 'Чернетка' : 'Опублікована';
}

export function sortProgramVersions(
  versions: readonly TrainingProgramVersionItem[],
): TrainingProgramVersionItem[] {
  return [...versions].sort((a, b) => b.version - a.version);
}

export function getProgramDisplayTitle(program: TrainingProgramItem): string {
  return sortProgramVersions(program.versions)[0]?.title ?? 'Програма без версій';
}

export function getProgramListError(status?: number): string {
  if (status === 400) return 'Некоректний фільтр або сторінка.';
  if (status === 403 || status === 404) return 'Немає доступу до тренувальних програм.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося завантажити програми. Спробуйте ще раз.';
}

export function getProgramPageCount(totalPages: number): number {
  return Number.isSafeInteger(totalPages) && totalPages > 0 ? totalPages : 1;
}

export function formatProgramDate(value: string | null): string {
  if (!value) return 'Не вказано';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата недоступна';
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' }).format(date);
}
