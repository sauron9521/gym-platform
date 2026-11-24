export type AcceptInvitationCommand = {
  relationshipId: string;
  respondedAt: Date;
};

export class InvitationAcceptanceConflict extends Error {
  constructor() {
    super('Relationship state has changed. Reload and try again.');
    this.name = 'InvitationAcceptanceConflict';
  }
}
