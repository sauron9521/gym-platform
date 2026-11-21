import { describe, expect, it } from 'vitest';

import { fullRelationshipReadWhere } from '../policies/trainer-athlete-read.policy.js';

describe('trainer-athlete read policy', () => {
  it('allows full own-athlete details without historical status restrictions', () => {
    expect(fullRelationshipReadWhere('actor-1', false)).toEqual({
      OR: [
        {
          athleteId: 'actor-1',
          athlete: { is: { deletedAt: null, role: { not: 'ADMIN' } } },
        },
      ],
    });
  });

  it('adds only live, non-admin, non-deleted trainer access for OPEN relationships', () => {
    expect(fullRelationshipReadWhere('actor-1', true)).toEqual({
      OR: [
        {
          athleteId: 'actor-1',
          athlete: { is: { deletedAt: null, role: { not: 'ADMIN' } } },
        },
        {
          trainerId: 'actor-1',
          status: { in: ['ACTIVE', 'PENDING'] },
          trainer: {
            is: {
              deletedAt: null,
              role: { not: 'ADMIN' },
              OR: [
                { trainerProfile: { is: { isActive: true } } },
                { role: 'TRAINER', trainerProfile: { is: null } },
              ],
            },
          },
        },
      ],
    });
  });
});
