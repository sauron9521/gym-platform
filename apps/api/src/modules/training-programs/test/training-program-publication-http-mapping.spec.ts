import { BadRequestException } from '@nestjs/common';

import type { PublishableVersion } from '../domain/publication.policy.js';
import { assertPublishableVersion } from '../policies/training-program-publication.policy.js';

const cases: Array<{ version: PublishableVersion; message: string }> = [
  {
    version: { durationWeeks: null, workouts: [] },
    message: 'A program must contain at least one workout',
  },
  {
    version: {
      durationWeeks: 1,
      workouts: [{ weekNumber: 2, exercises: [{ sets: [{}] }] }],
    },
    message: 'A workout week cannot exceed the program duration',
  },
  {
    version: { durationWeeks: 1, workouts: [{ weekNumber: 1, exercises: [] }] },
    message: 'Every program workout must contain at least one exercise',
  },
  {
    version: {
      durationWeeks: 1,
      workouts: [{ weekNumber: 1, exercises: [{ sets: [] }] }],
    },
    message: 'Every program exercise must contain at least one set',
  },
];

describe('Publication policy HTTP compatibility', () => {
  it.each(cases)('preserves the 400 response for $message', ({ version, message }) => {
    try {
      assertPublishableVersion(version);
      throw new Error('Expected publication to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(400);
      expect((error as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message,
        error: 'Bad Request',
      });
    }
  });

  it('does not translate unexpected failures into a bad request', () => {
    const unexpected = new Error('Unexpected failure');
    const version: PublishableVersion = {
      durationWeeks: null,
      get workouts(): PublishableVersion['workouts'] {
        throw unexpected;
      },
    };
    expect(() => assertPublishableVersion(version)).toThrow(unexpected);
  });
});
