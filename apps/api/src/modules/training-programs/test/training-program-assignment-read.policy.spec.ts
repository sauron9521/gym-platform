import { describe, expect, it } from 'vitest';
import {
  assignmentFullReadWhere,
  assignmentParticipantWhere,
} from '../policies/training-program-assignment-read.policy.js';

describe('training program assignment read policy', () => {
  it('preserves both role-independent participant sides after trainer revocation', () => {
    expect(assignmentParticipantWhere('dual-1')).toEqual({
      OR: [
        {
          athleteId: 'dual-1',
          athlete: { is: { deletedAt: null, role: { not: 'ADMIN' } } },
        },
        {
          version: {
            program: {
              trainerId: 'dual-1',
              trainer: { is: { deletedAt: null, role: { not: 'ADMIN' } } },
            },
          },
          trainerAthlete: { is: { trainerId: 'dual-1' } },
        },
      ],
    });
  });

  it('returns full athlete history but gates trainer details by approval and ACTIVE relationship', () => {
    expect(assignmentFullReadWhere('dual-1')).toEqual({
      OR: [
        {
          athleteId: 'dual-1',
          athlete: { is: { deletedAt: null, role: { not: 'ADMIN' } } },
        },
        {
          version: {
            program: {
              trainerId: 'dual-1',
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
          },
          trainerAthlete: { is: { trainerId: 'dual-1', status: 'ACTIVE' } },
        },
      ],
    });
  });
});
