export type InvitationCapabilities = {
  athlete: boolean;
  trainer: boolean;
  admin: boolean;
};

export type InvitationPair = {
  trainerId: string;
  athleteId: string;
};

export type InvitationDirection =
  | { status: 'ALLOWED'; pair: InvitationPair }
  | { status: 'AMBIGUOUS' }
  | { status: 'INELIGIBLE' };

export function isSelfInvitation(actorId: string, targetId: string): boolean {
  return actorId === targetId;
}

export function canInitiateInvitation(capabilities: InvitationCapabilities): boolean {
  return capabilities.athlete && !capabilities.admin;
}

/** Resolve direction after the initiator has passed the current capability check. */
export function resolveInvitationDirection(
  actorId: string,
  targetId: string,
  actor: InvitationCapabilities,
  target: InvitationCapabilities,
): InvitationDirection {
  const trainerInvitesAthlete = actor.trainer && target.athlete;
  const athleteInvitesTrainer = actor.athlete && target.trainer;

  if (trainerInvitesAthlete && athleteInvitesTrainer) {
    return { status: 'AMBIGUOUS' };
  }
  if (!trainerInvitesAthlete && !athleteInvitesTrainer) {
    return { status: 'INELIGIBLE' };
  }

  return {
    status: 'ALLOWED',
    pair: {
      trainerId: trainerInvitesAthlete ? actorId : targetId,
      athleteId: trainerInvitesAthlete ? targetId : actorId,
    },
  };
}
