import { describe, expect, it } from 'vitest';

import { trainerApplicationInputSchema } from '../dto/trainer-application.schemas.js';

describe('trainer application public input', () => {
  it('trims and bounds the applicant note', () => {
    expect(
      trainerApplicationInputSchema.parse({
        applicantNote: '   I coach powerlifting and strength training.   ',
      }),
    ).toEqual({ applicantNote: 'I coach powerlifting and strength training.' });
  });

  it.each([
    {},
    { applicantNote: '' },
    { applicantNote: 'short' },
    { applicantNote: 'x'.repeat(1001) },
    { applicantNote: 123 },
    { applicantNote: 'A'.repeat(30), status: 'APPROVED' },
    { applicantNote: 'A'.repeat(30), reviewerId: 'admin' },
    { applicantNote: 'A'.repeat(30), role: 'TRAINER' },
    { applicantNote: 'A'.repeat(30), userId: 'someone-else' },
  ])('rejects invalid or privilege-bearing data', (input) => {
    expect(trainerApplicationInputSchema.safeParse(input).success).toBe(false);
  });
});
