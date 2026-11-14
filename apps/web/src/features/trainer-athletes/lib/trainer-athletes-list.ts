import type { operations } from '@gym/api-client';

type RelationshipsResponse =
  operations['TrainerAthletesController_findMany']['responses'][200]['content']['application/json'];

export type TrainerAthleteListItem = RelationshipsResponse['data'][number];
export type TrainerAthleteStatus = TrainerAthleteListItem['status'];
export type TrainerAthleteFilter = TrainerAthleteStatus | 'ALL';

export const TRAINER_ATHLETE_FILTERS: ReadonlyArray<{
  value: TrainerAthleteFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'Усі статуси' },
  { value: 'PENDING', label: 'Очікують відповіді' },
  { value: 'ACTIVE', label: 'Активні' },
  { value: 'DECLINED', label: 'Відхилені' },
  { value: 'CANCELLED', label: 'Скасовані' },
  { value: 'TERMINATED', label: 'Завершені' },
];

export function getTrainerAthleteStatusLabel(status: TrainerAthleteStatus): string {
  const option = TRAINER_ATHLETE_FILTERS.find((item) => item.value === status);
  return option?.label ?? 'Невідомий статус';
}

export function getTrainerAthleteListErrorMessage(status?: number): string {
  if (status === 400) return 'Некоректні параметри списку. Оновіть сторінку.';
  if (status === 403 || status === 404) return 'Немає дозволу переглядати підопічних.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося завантажити підопічних. Перевірте з’єднання та спробуйте ще раз.';
}

export function getTrainerAthletePageCount(count: number): number {
  return Number.isSafeInteger(count) && count > 0 ? count : 1;
}

export function formatTrainerAthleteDate(date: string | null): string {
  if (!date) return 'Не вказано';
  const timestamp = new Date(date);
  if (Number.isNaN(timestamp.getTime())) return 'Дата недоступна';
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' }).format(timestamp);
}

/** A former trainer must not receive names or emails for archived relationships. */
export function getRelationshipContact(
  relationship: TrainerAthleteListItem,
  role: 'TRAINER' | 'ATHLETE',
): string | null {
  const participant = role === 'TRAINER' ? relationship.athlete : relationship.trainer;
  return 'email' in participant && typeof participant.email === 'string'
    ? participant.email
    : null;
}

export function getTrainerAthleteContact(relationship: TrainerAthleteListItem): string | null {
  return getRelationshipContact(relationship, 'TRAINER');
}

export function searchTrainerAthletesOnPage(
  items: readonly TrainerAthleteListItem[],
  query: string,
  role: 'TRAINER' | 'ATHLETE' = 'TRAINER',
): TrainerAthleteListItem[] {
  const search = query.trim().toLocaleLowerCase('uk-UA');
  if (!search) return [...items];
  return items.filter((relationship) =>
    getRelationshipContact(relationship, role)?.toLocaleLowerCase('uk-UA').includes(search),
  );
}

export function getTrainerAthleteInvitationLabel(
  relationship: TrainerAthleteListItem,
  trainerId: string,
): string {
  return relationship.initiatedById === trainerId ? 'Запросив тренер' : 'Запросив атлет';
}
