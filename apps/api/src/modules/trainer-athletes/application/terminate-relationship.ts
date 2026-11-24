export type TerminateRelationshipCommand = {
  id: string;
  actorId: string;
  reason?: string | null;
  redactForTrainer: boolean;
};

export type RelationshipTerminationResult<Relationship> =
  { status: 'TERMINATED'; relationship: Relationship } | { status: 'STATE_CHANGED' };
