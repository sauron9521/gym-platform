export type AcceptInvitationCommand = {
  relationshipId: string;
  respondedAt: Date;
};

export type ClosePendingInvitationCommand = {
  relationshipId: string;
  redactForTrainer: boolean;
} & (
  | { status: 'DECLINED'; respondedAt: Date }
  | { status: 'CANCELLED'; endedAt: Date; endedById: string; endReason: string | null }
);

export class PendingInvitationConflict extends Error {
  constructor() {
    super('Relationship state has changed. Reload and try again.');
    this.name = 'PendingInvitationConflict';
  }
}
