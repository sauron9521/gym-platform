import { describe, expect, it } from 'vitest';

import {
  adminAccountStatusCommandSchema,
  adminAccountStatusTargetSchema,
} from '../dto/admin-account-status.dto.js';

const uuid = 'f09d7567-626e-45d8-99f1-829ce4204fbd';

describe('future Admin account-status command contract (not yet routed)', () => {
  it('accepts only a valid account UUID and strict, trimmed status command', () => {
    expect(adminAccountStatusTargetSchema.parse(uuid)).toBe(uuid);
    expect(adminAccountStatusCommandSchema.parse({
      expectedStatus: 'ACTIVE',
      reason: '  Repeated abusive activity  ',
    })).toEqual({
      expectedStatus: 'ACTIVE',
      reason: 'Repeated abusive activity',
    });
    expect(adminAccountStatusCommandSchema.parse({
      expectedStatus: 'SUSPENDED',
      reason: 'Відновлення після перевірки',
    })).toEqual({
      expectedStatus: 'SUSPENDED',
      reason: 'Відновлення після перевірки',
    });
  });

  it('rejects missing, short, overlong, control-character and unexpected command data', () => {
    for (const payload of [
      {},
      { expectedStatus: 'ACTIVE' },
      { expectedStatus: 'ACTIVE', reason: 'short' },
      { expectedStatus: 'ACTIVE', reason: ' '.repeat(20) },
      { expectedStatus: 'ACTIVE', reason: 'a'.repeat(501) },
      { expectedStatus: 'ACTIVE', reason: 'reason\nwith newline' },
      { expectedStatus: 'SUSPENDED', reason: 'reason\u0000control' },
      { expectedStatus: 'DELETED', reason: 'Valid reason here' },
      { expectedStatus: 'ACTIVE', reason: 'Valid reason here', userId: uuid },
      { expectedStatus: 'ACTIVE', reason: 'Valid reason here', role: 'ADMIN' },
      { expectedStatus: 'ACTIVE', reason: 'Valid reason here', revokeSessions: false },
    ]) {
      expect(adminAccountStatusCommandSchema.safeParse(payload).success).toBe(false);
    }
    for (const value of ['../accounts', 'not-a-uuid', '', uuid + '/sessions']) {
      expect(adminAccountStatusTargetSchema.safeParse(value).success).toBe(false);
    }
  });
});
