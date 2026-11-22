import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ADMIN_SESSION_PURPOSE, AdminSessionPurposeGuard } from './admin-session-purpose.guard.js';

function context(user: unknown, session: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, session }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminSessionPurposeGuard', () => {
  const guard = new AdminSessionPurposeGuard();
  const operator = { id: 'operator', role: 'ADMIN' };
  const purposeSession = { metadata: { purpose: ADMIN_SESSION_PURPOSE } };

  it('permits a persisted ADMIN with an explicit server-issued purpose', () => {
    expect(guard.canActivate(context(operator, purposeSession))).toBe(true);
  });

  it.each([
    [null, purposeSession],
    [operator, null],
    [operator, { metadata: null }],
    [operator, { metadata: {} }],
    [operator, { metadata: { purpose: 'web' } }],
    [operator, { metadata: { purpose: true } }],
    [{ id: 'operator', role: 'ATHLETE' }, purposeSession],
    [{ id: '', role: 'ADMIN' }, purposeSession],
  ])('denies a missing, regular or revoked admin principal and session (%#)', (user, session) => {
    expect(() => guard.canActivate(context(user, session))).toThrow(ForbiddenException);
  });
});
