import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  decideLockedAccountStatusTransition,
  type AccountStatusTransition,
} from '../policies/admin-account-status.policy.js';

const primary = 'f09d7567-626e-45d8-99f1-829ce4204fbd';
const backup = 'd09c7567-626e-45d8-99f1-829ce4204fbd';
const athlete = 'b09c7567-626e-45d8-99f1-829ce4204fbd';
const operators = new Set([primary, backup]);

function request(overrides: Partial<AccountStatusTransition> = {}): AccountStatusTransition {
  return {
    actor: { id: primary, role: 'ADMIN' },
    target: { id: athlete, role: 'ATHLETE', status: 'ACTIVE' },
    action: 'SUSPEND',
    expectedStatus: 'ACTIVE',
    operatorIds: operators,
    ...overrides,
  };
}

describe('locked account-status transition policy (no mutation endpoint)', () => {
  it('requires explicitly allowlisted, persisted ADMIN even for repeat/no-op commands', () => {
    for (const actor of [
      { id: athlete, role: 'ADMIN' },
      { id: primary, role: 'ATHLETE' },
      { id: primary, role: 'TRAINER' },
    ] as const) {
      for (const status of ['ACTIVE', 'SUSPENDED'] as const) {
        expect(() =>
          decideLockedAccountStatusTransition(
            request({
              actor,
              target: { id: athlete, role: 'ATHLETE', status },
            }),
          ),
        ).toThrow(ForbiddenException);
      }
    }
    expect(() => decideLockedAccountStatusTransition(request({ operatorIds: new Set() }))).toThrow(
      ForbiddenException,
    );
  });

  it('never permits self-suspension or suspension of ANY allowlisted operator', () => {
    for (const targetId of [primary, backup]) {
      for (const status of ['ACTIVE', 'SUSPENDED'] as const) {
        expect(() =>
          decideLockedAccountStatusTransition(
            request({
              target: { id: targetId, role: 'ADMIN', status },
            }),
          ),
        ).toThrow(ForbiddenException);
      }
    }
    // Even a single remaining operator cannot be suspended.
    expect(() =>
      decideLockedAccountStatusTransition(
        request({
          operatorIds: new Set([primary]),
          target: { id: primary, role: 'ADMIN', status: 'ACTIVE' },
        }),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      decideLockedAccountStatusTransition(
        request({
          actor: { id: backup.toUpperCase(), role: 'ADMIN' },
          target: { id: backup, role: 'ATHLETE', status: 'ACTIVE' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('plans ACTIVE -> SUSPENDED and SUSPENDED -> ACTIVE, without writing anything', () => {
    expect(decideLockedAccountStatusTransition(request())).toEqual({
      kind: 'change',
      from: 'ACTIVE',
      to: 'SUSPENDED',
    });
    expect(
      decideLockedAccountStatusTransition(
        request({
          action: 'REACTIVATE',
          target: { id: athlete, role: 'ATHLETE', status: 'SUSPENDED' },
          expectedStatus: 'SUSPENDED',
        }),
      ),
    ).toEqual({ kind: 'change', from: 'SUSPENDED', to: 'ACTIVE' });
  });

  it('is idempotent for retries in the desired state, even with original expectedStatus', () => {
    expect(
      decideLockedAccountStatusTransition(
        request({
          target: { id: athlete, role: 'ATHLETE', status: 'SUSPENDED' },
        }),
      ),
    ).toEqual({ kind: 'unchanged', status: 'SUSPENDED' });
    expect(
      decideLockedAccountStatusTransition(
        request({
          action: 'REACTIVATE',
          expectedStatus: 'SUSPENDED',
          target: { id: athlete, role: 'ATHLETE', status: 'ACTIVE' },
        }),
      ),
    ).toEqual({ kind: 'unchanged', status: 'ACTIVE' });
  });

  it('rejects stale expected status when a different transition would occur', () => {
    expect(() =>
      decideLockedAccountStatusTransition(
        request({
          action: 'REACTIVATE',
          target: { id: athlete, role: 'ATHLETE', status: 'SUSPENDED' },
          expectedStatus: 'ACTIVE',
        }),
      ),
    ).toThrow(ConflictException);
    expect(() =>
      decideLockedAccountStatusTransition(
        request({
          action: 'SUSPEND',
          target: { id: athlete, role: 'ATHLETE', status: 'ACTIVE' },
          expectedStatus: 'SUSPENDED',
        }),
      ),
    ).toThrow(ConflictException);
  });

  it('fails closed on unexpected states or unknown actions before a future DB write', () => {
    expect(() =>
      decideLockedAccountStatusTransition(
        request({
          target: { id: athlete, role: 'ATHLETE', status: 'DELETED' as 'ACTIVE' },
        }),
      ),
    ).toThrow(ConflictException);
    expect(() =>
      decideLockedAccountStatusTransition(
        request({
          action: 'DELETE' as 'SUSPEND',
        }),
      ),
    ).toThrow(ConflictException);
  });
});
