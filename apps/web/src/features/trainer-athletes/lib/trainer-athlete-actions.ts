import { z } from 'zod';

import type { TrainerAthleteListItem } from './trainer-athletes-list';

export const invitationSchema = z.object({
  userId: z.uuid('Вкажіть коректний UUID користувача.'),
});

export const endRelationshipSchema = z.object({
  reason: z.string().trim().max(500, 'Максимум 500 символів.'),
});

export type InvitationValues = z.infer<typeof invitationSchema>;
export type EndRelationshipValues = z.infer<typeof endRelationshipSchema>;

export type RelationshipAction = 'accept' | 'decline' | 'cancel' | 'terminate';

export function getAvailableRelationshipActions(
  relationship: Pick<
    TrainerAthleteListItem,
    'status' | 'initiatedById' | 'trainerId' | 'athleteId'
  >,
  actorId: string,
): RelationshipAction[] {
  if (relationship.trainerId !== actorId && relationship.athleteId !== actorId) return [];
  if (relationship.status === 'PENDING') {
    return relationship.initiatedById === actorId ? ['cancel'] : ['accept', 'decline'];
  }
  return relationship.status === 'ACTIVE' ? ['terminate'] : [];
}

export const RELATIONSHIP_ACTION_LABELS: Record<RelationshipAction, string> = {
  accept: 'Прийняти запрошення',
  decline: 'Відхилити запрошення',
  cancel: 'Скасувати запрошення',
  terminate: 'Завершити співпрацю',
};

export function getRelationshipMutationError(status?: number): string {
  if (status === 400) return 'Неправильні дані. Перевірте ID та введені поля.';
  if (status === 403) return 'Немає прав виконати цю дію.';
  if (status === 404) return 'Користувача або запрошення не знайдено.';
  if (status === 409) return 'Запрошення або стан співпраці вже змінився. Оновіть список.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося виконати дію. Перевірте список перед повторенням.';
}
