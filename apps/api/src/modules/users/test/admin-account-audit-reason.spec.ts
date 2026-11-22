import { describe, expect, it } from 'vitest';

import { adminAccountStatusReasonSchema } from '../policies/admin-account-audit-reason.policy.js';

describe('admin status audit reason contract', () => {
  it.each(['SECURITY', 'POLICY', 'USER_REQUEST', 'ERROR_CORRECTION'])(
    'accepts explicitly classified reason %s',
    (reason) => {
      expect(adminAccountStatusReasonSchema.parse(reason)).toBe(reason);
    },
  );

  it.each(['', 'other', 'SECURITY ', 'investigation against user@email.test', null])(
    'rejects unclassified or free-form reason %s',
    (reason) => {
      expect(adminAccountStatusReasonSchema.safeParse(reason).success).toBe(false);
    },
  );
});
