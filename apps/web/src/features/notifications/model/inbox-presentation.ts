import type { InboxItem } from '../api/inbox';

export const notificationTitleKeys = {
  'account.security.changed': 'securityChanged',
  'trainer.invitation.created': 'invitationCreated',
  'trainer.invitation.accepted': 'invitationAccepted',
  'trainer.invitation.declined': 'invitationDeclined',
  'trainer.invitation.cancelled': 'invitationCancelled',
  'trainer.relationship.terminated': 'relationshipTerminated',
  'program.assigned': 'programAssigned',
  'program.assignment.cancelled': 'programCancelled',
  'program.assignment.terminated': 'programTerminated',
  'program.assignment.completed': 'programCompleted',
  'trainer.application.reviewed': 'applicationReviewed',
  'trainer.application.revoked': 'applicationRevoked',
} as const satisfies Record<InboxItem['templateKey'], string>;

export function inboxTitleKey(item: InboxItem) {
  return Object.hasOwn(notificationTitleKeys, item.templateKey) && item.type === item.templateKey
    ? notificationTitleKeys[item.templateKey]
    : 'generic';
}

// No dynamic URLs from server payloads. The existing resource routes
// enforce the original athlete capability and resource authorization.
export function inboxDestination(item: InboxItem) {
  if (item.type !== item.templateKey) return null;
  if (
    item.category === 'PROGRAM' &&
    item.target?.kind === 'PROGRAM_ASSIGNMENT' &&
    [
      'program.assigned',
      'program.assignment.cancelled',
      'program.assignment.terminated',
      'program.assignment.completed',
    ].includes(item.type)
  )
    return '/athlete/programs';
  if (
    item.category === 'TRAINER' &&
    [
      'trainer.invitation.created',
      'trainer.invitation.accepted',
      'trainer.invitation.declined',
      'trainer.invitation.cancelled',
      'trainer.relationship.terminated',
    ].includes(item.type)
  )
    return '/athlete/trainers';
  return null;
}
