import { deriveAccountCapabilities } from '../policies/account-capabilities.policy.js';

describe('deriveAccountCapabilities', () => {
  it.each([
    ['ATHLETE', null, true, false, false],
    ['ATHLETE', { isActive: true }, true, true, false],
    ['ATHLETE', { isActive: false }, true, false, false],
    ['TRAINER', null, true, true, false],
    ['TRAINER', { isActive: true }, true, true, false],
    ['TRAINER', { isActive: false }, true, false, false],
    ['ADMIN', null, false, false, true],
    ['ADMIN', { isActive: true }, false, false, true],
    ['ADMIN', { isActive: false }, false, false, true],
  ] as const)(
    'maps role=%s profile=%j to athlete=%s trainer=%s admin=%s',
    (role, trainerProfile, athlete, trainer, admin) => {
      expect(deriveAccountCapabilities({ role, trainerProfile })).toEqual({
        athlete,
        trainer,
        admin,
      });
    },
  );

  it('does not mutate an input profile when evaluating revocation', () => {
    const profile = Object.freeze({ isActive: false });
    expect(deriveAccountCapabilities({ role: 'TRAINER', trainerProfile: profile }).trainer).toBe(
      false,
    );
  });
});
