import { describe, expect, it } from 'vitest';

import {
  canInitiateInvitation,
  isSelfInvitation,
  resolveInvitationDirection,
} from '../domain/invitation-policy.js';

describe('invitation policy', () => {
  const athlete = { athlete: true, trainer: false, admin: false };
  const trainer = { athlete: true, trainer: true, admin: false };
  const admin = { athlete: false, trainer: false, admin: true };
  const unavailable = { athlete: false, trainer: false, admin: false };

  it('rejects self invitations by identity rather than role', () => {
    expect(isSelfInvitation('actor', 'actor')).toBe(true);
    expect(isSelfInvitation('actor', 'target')).toBe(false);
  });

  it.each([
    [athlete, true],
    [trainer, true],
    [admin, false],
    [unavailable, false],
    [{ ...trainer, admin: true }, false],
  ] as const)('checks initiator capabilities %j', (capabilities, allowed) => {
    expect(canInitiateInvitation(capabilities)).toBe(allowed);
  });

  it('assigns the trainer initiator to the trainer side', () => {
    expect(resolveInvitationDirection('actor', 'target', trainer, athlete)).toEqual({
      status: 'ALLOWED',
      pair: { trainerId: 'actor', athleteId: 'target' },
    });
  });

  it('assigns the trainer recipient to the trainer side', () => {
    expect(resolveInvitationDirection('actor', 'target', athlete, trainer)).toEqual({
      status: 'ALLOWED',
      pair: { trainerId: 'target', athleteId: 'actor' },
    });
  });

  it('rejects ambiguity when both participants are approved trainers', () => {
    expect(resolveInvitationDirection('actor', 'target', trainer, trainer)).toEqual({
      status: 'AMBIGUOUS',
    });
  });

  it.each([
    [athlete, athlete],
    [athlete, admin],
    [trainer, admin],
    [trainer, unavailable],
    [athlete, unavailable],
  ] as const)('rejects incompatible capability pairs %j / %j', (actor, target) => {
    expect(resolveInvitationDirection('actor', 'target', actor, target)).toEqual({
      status: 'INELIGIBLE',
    });
  });
});
