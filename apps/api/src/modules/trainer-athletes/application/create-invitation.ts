import type { InvitationPair } from '../domain/invitation-policy.js';

export type CreateInvitationCommand = InvitationPair & {
  initiatedById: string;
};

export class InvitationAlreadyExists extends Error {
  constructor() {
    super('An active or pending relationship already exists');
    this.name = 'InvitationAlreadyExists';
  }
}
