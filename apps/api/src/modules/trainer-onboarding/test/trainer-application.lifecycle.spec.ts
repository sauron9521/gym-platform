import { describe, expect, it } from 'vitest';

import { nextTrainerApplicationStatus } from '../domain/trainer-application.lifecycle.js';

describe('trainer application lifecycle', () => {
  it('supports only reviewed approval/rejection and revocation', () => {
    expect(nextTrainerApplicationStatus('PENDING', 'APPROVE')).toBe('APPROVED');
    expect(nextTrainerApplicationStatus('PENDING', 'REJECT')).toBe('REJECTED');
    expect(nextTrainerApplicationStatus('APPROVED', 'REVOKE')).toBe('REVOKED');
  });

  it.each([
    ['PENDING', 'REVOKE'],
    ['APPROVED', 'APPROVE'],
    ['APPROVED', 'REJECT'],
    ['REJECTED', 'APPROVE'],
    ['REJECTED', 'REVOKE'],
    ['REVOKED', 'APPROVE'],
    ['REVOKED', 'REJECT'],
  ] as const)('rejects %s → %s', (status, action) => {
    expect(() => nextTrainerApplicationStatus(status, action)).toThrow(
      'Invalid trainer application status transition',
    );
  });
});
