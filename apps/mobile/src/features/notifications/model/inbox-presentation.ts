import type { InboxItem } from '../services/inbox-api';

const titles: Record<string, string> = {
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
};
export function inboxTitleKey(item: InboxItem) {
  return item.type === item.templateKey && Object.hasOwn(titles, item.templateKey)
    ? titles[item.templateKey]!
    : 'generic';
}
