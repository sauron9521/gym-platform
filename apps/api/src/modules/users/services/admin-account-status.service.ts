import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Prisma, type AccountStatus, type Role } from '#prisma/client';
import { hasAdminPermission } from '#src/common/rbac/admin-permissions';
import { parseOperatorSuperAdminIds } from '#src/common/rbac/operator-superadmin-allowlist';
import { PrismaService } from '#src/infra/database/index';

import {
  decideLockedAccountStatusTransition,
  type AccountStatusAction,
} from '../policies/admin-account-status.policy.js';

type LockedUserRow = {
  id: string;
  role: Role;
  status: AccountStatus;
  deletedAt: Date | null;
};
export type AdminAccountStatusResult = Readonly<{
  kind: 'changed' | 'unchanged';
  status: AccountStatus;
}>;

/**
 * Internal atomic primitive only. Not exposed via an HTTP controller.
 * Exposing privileged mutations requires transactionally durable audit.
 */
@Injectable()
export class AdminAccountStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async transition(
    actorId: string,
    targetId: string,
    action: AccountStatusAction,
    expectedStatus: AccountStatus,
  ): Promise<AdminAccountStatusResult> {
    const operators = parseOperatorSuperAdminIds(this.config.get('SUPERADMIN_USER_IDS'));
    // Check operator allowlist before looking up the target (no user enumeration).
    if (!hasAdminPermission('ADMIN', 'admin.accounts.manage', actorId, operators)) {
      throw new ForbiddenException('Insufficient administrative permissions');
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Stable lock order prevents opposite-direction request deadlocks.
          // Both actor role and target state are re-read from locked DB rows.
          const rowIds = Array.from(new Set([actorId, targetId])).sort();
          const locked = new Map<string, LockedUserRow>();
          for (const id of rowIds) {
            const rows = await tx.$queryRaw<LockedUserRow[]>`
            SELECT "id", "role", "status", "deleted_at" AS "deletedAt"
            FROM "users"
            WHERE "id" = ${id}
            FOR UPDATE
          `;
            if (rows[0]) locked.set(id, rows[0]);
          }

          const actor = locked.get(actorId);
          if (!actor || actor.deletedAt || actor.status !== 'ACTIVE' || actor.role !== 'ADMIN') {
            throw new ForbiddenException('Invalid operator');
          }
          const target = locked.get(targetId);
          if (!target || target.deletedAt) throw new NotFoundException('Account not found');

          const decision = decideLockedAccountStatusTransition({
            actor: { id: actor.id, role: actor.role },
            target: { id: target.id, role: target.role, status: target.status },
            action,
            expectedStatus,
            operatorIds: operators,
          });
          if (decision.kind === 'unchanged') {
            return { kind: 'unchanged', status: decision.status };
          }

          // Advance fence on BOTH suspension and reactivation. A JWT minted
          // during suspension must not later become valid on reactivation.
          const fence = new Date();
          const updated = await tx.user.updateMany({
            where: { id: targetId, deletedAt: null, status: decision.from },
            data: { status: decision.to, authInvalidatedAt: fence },
          });
          if (updated.count !== 1) throw new ConflictException('Account status changed');

          // Revoke on BOTH transitions: a manually SUSPENDED account with
          // lingering credentials must not regain them on reactivation.
          // Writers first lock the same user row inside their transactions.
          await tx.session.deleteMany({ where: { userId: targetId } });
          await tx.refreshTokenFamily.updateMany({
            where: { userId: targetId },
            data: { revokedAt: fence },
          });
          await tx.refreshToken.updateMany({
            where: { userId: targetId },
            data: { revoked: true },
          });
          return { kind: 'changed', status: decision.to };
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
        throw new ConflictException('Concurrent account status transition');
      throw error;
    }
  }
}
