import { ConflictException, ForbiddenException } from '@nestjs/common';

import type { Role } from '#prisma/client';
import { hasAdminPermission } from '#src/common/rbac/admin-permissions';

export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

const ACCOUNT_STATUS_ACTIONS = ['SUSPEND', 'REACTIVATE'] as const;
export type AccountStatusAction = (typeof ACCOUNT_STATUS_ACTIONS)[number];

export type AccountStatusTransition = Readonly<{
  actor: { id: string; role: Role };
  target: { id: string; role: Role; status: AccountStatus };
  action: AccountStatusAction;
  expectedStatus: AccountStatus;
  operatorIds: ReadonlySet<string>;
}>;

export type AccountStatusDecision =
  | { kind: 'unchanged'; status: AccountStatus }
  | { kind: 'change'; from: AccountStatus; to: AccountStatus };

/**
 * Policy for a future transactionally locked account-status command.
 *
 * This function does NOT read or write the database, issue/revoke sessions,
 * or authorize an HTTP request by itself. Call it ONLY with the actor and
 * target's freshly re-read, locked persisted state, inside the same transaction
 * that will atomically update the account and revoke credentials.
 */
export function decideLockedAccountStatusTransition(
  input: AccountStatusTransition,
): AccountStatusDecision {
  const { actor, target, action, expectedStatus, operatorIds } = input;

  // All mutation attempts, including no-op retries, must be authorized first.
  if (!hasAdminPermission(actor.role, 'admin.accounts.manage', actor.id, operatorIds)) {
    throw new ForbiddenException('Insufficient administrative permissions');
  }

  if (!ACCOUNT_STATUSES.includes(target.status) || !ACCOUNT_STATUSES.includes(expectedStatus)) {
    throw new ConflictException('Unsupported account status');
  }
  if (!ACCOUNT_STATUS_ACTIONS.includes(action)) {
    throw new ConflictException('Unsupported account status action');
  }

  if (action === 'SUSPEND') {
    // Conservative bootstrap: *every* configured operator is protected, not
    // just the currently last one. This makes last-operator lockout impossible
    // until durable role/grant tracking is implemented.
    if (
      actor.id.toLowerCase() === target.id.toLowerCase() ||
      operatorIds.has(target.id.toLowerCase())
    ) {
      throw new ForbiddenException('Suspending an operator or self is not allowed');
    }
  }

  const desiredStatus: AccountStatus = action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';

  // Repeated command after success must be harmless, including when the caller
  // retries with the original expectedStatus. A different requested transition
  // against stale state must instead fail with a conflict.
  if (target.status === desiredStatus) {
    return { kind: 'unchanged', status: desiredStatus };
  }
  if (target.status !== expectedStatus) {
    throw new ConflictException('Account status changed; refresh before retrying');
  }

  return { kind: 'change', from: target.status, to: desiredStatus };
}
