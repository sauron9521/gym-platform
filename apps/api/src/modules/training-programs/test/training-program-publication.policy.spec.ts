import {
  assertPublishableVersion,
  ProgramPublicationError,
} from '../domain/publication.policy.js';

describe('assertPublishableVersion', () => {
  const validVersion = () => ({
    durationWeeks: 4 as number | null,
    workouts: [
      {
        weekNumber: 1,
        exercises: [{ sets: [{ setNumber: 1 }] }],
      },
    ],
  });

  it('exposes stable domain failure codes without HTTP dependencies', () => {
    const cases = [
      ['EMPTY_PROGRAM', 'A program must contain at least one workout'],
      ['WORKOUT_OUTSIDE_DURATION', 'A workout week cannot exceed the program duration'],
      ['EMPTY_WORKOUT', 'Every program workout must contain at least one exercise'],
      ['EMPTY_EXERCISE', 'Every program exercise must contain at least one set'],
    ] as const;

    for (const [code, message] of cases) {
      const error = new ProgramPublicationError(code);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
    }
  });

  it('accepts a program with one executable workout and exercise set', () => {
    expect(() => assertPublishableVersion(validVersion())).not.toThrow();
  });

  it('accepts multiple valid workouts and exercises across the duration', () => {
    const version = {
      durationWeeks: 4,
      workouts: [
        {
          weekNumber: 1,
          exercises: [{ sets: [{}] }, { sets: [{}, {}] }],
        },
        { weekNumber: 4, exercises: [{ sets: [{}] }] },
      ],
    };
    expect(() => assertPublishableVersion(version)).not.toThrow();
  });

  it('allows an unspecified duration while still requiring executable content', () => {
    const version = validVersion();
    version.durationWeeks = null;
    version.workouts[0].weekNumber = 5;

    expect(() => assertPublishableVersion(version)).not.toThrow();
  });

  it('accepts a workout on the last week of the configured duration', () => {
    const version = validVersion();
    version.workouts[0].weekNumber = 4;
    expect(() => assertPublishableVersion(version)).not.toThrow();
  });

  it('rejects publishing an empty program', () => {
    expect(() =>
      assertPublishableVersion({
        durationWeeks: 4,
        workouts: [],
      }),
    ).toThrow(new ProgramPublicationError('EMPTY_PROGRAM'));
  });

  it('rejects a workout beyond the configured duration', () => {
    const version = validVersion();
    version.workouts[0].weekNumber = 5;

    expect(() => assertPublishableVersion(version)).toThrow(
      new ProgramPublicationError('WORKOUT_OUTSIDE_DURATION'),
    );
  });

  it('rejects a workout without exercises', () => {
    const version = validVersion();
    version.workouts[0].exercises = [];

    expect(() => assertPublishableVersion(version)).toThrow(
      new ProgramPublicationError('EMPTY_WORKOUT'),
    );
  });

  it('rejects exercises with no sets', () => {
    const version = validVersion();
    version.workouts[0].exercises[0].sets = [];

    expect(() => assertPublishableVersion(version)).toThrow(
      new ProgramPublicationError('EMPTY_EXERCISE'),
    );
  });

  it('checks later workouts rather than only the first', () => {
    const version = {
      durationWeeks: 4,
      workouts: [
        { weekNumber: 1, exercises: [{ sets: [{}] }] },
        { weekNumber: 2, exercises: [{ sets: [] }] },
      ],
    };

    expect(() => assertPublishableVersion(version)).toThrow(
      new ProgramPublicationError('EMPTY_EXERCISE'),
    );
  });

  it('checks later exercises rather than only the first', () => {
    const version = {
      durationWeeks: 4,
      workouts: [{ weekNumber: 1, exercises: [{ sets: [{}] }, { sets: [] }] }],
    };

    expect(() => assertPublishableVersion(version)).toThrow(
      new ProgramPublicationError('EMPTY_EXERCISE'),
    );
  });
});
