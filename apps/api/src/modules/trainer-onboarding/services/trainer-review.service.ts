import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Prisma } from '#prisma/client';
import { AdminAuditLogger } from '#src/common/audit/admin-audit.logger';
import { hasAdminPermission } from '#src/common/rbac/admin-permissions';
import { parseOperatorSuperAdminIds } from '#src/common/rbac/operator-superadmin-allowlist';

import type { TrainerReviewDecision } from '../dto/trainer-review.schemas.js';
import type { TrainerReviewAction } from '../domain/trainer-application.lifecycle.js';
import { TrainerReviewRepository } from '../repositories/trainer-review.repository.js';

export type Reviewer = { id: string; role: 'ATHLETE' | 'TRAINER' | 'ADMIN' };

@Injectable()
export class TrainerReviewService {
  constructor(
    private readonly repository: TrainerReviewRepository,
    private readonly config: ConfigService,
    private readonly audit: AdminAuditLogger,
  ) {}

  private assertOperator(reviewer: Reviewer): void {
    const trusted = parseOperatorSuperAdminIds(this.config.get<string>('SUPERADMIN_USER_IDS'));
    if (!hasAdminPermission(reviewer.role, 'admin.accounts.manage', reviewer.id, trusted)) {
      throw new ForbiddenException('Insufficient administrative permissions');
    }
  }

  async findPending(reviewer: Reviewer) {
    this.assertOperator(reviewer);
    if (!(await this.repository.isCurrentAdmin(reviewer.id))) {
      throw new ForbiddenException('Invalid reviewer');
    }
    return this.repository.findPending();
  }

  async decide(
    applicationId: string,
    reviewer: Reviewer,
    action: TrainerReviewAction,
    input: TrainerReviewDecision,
  ) {
    this.assertOperator(reviewer);

    try {
      const result = await this.repository.decide(applicationId, reviewer.id, action, input.reason);

      if (result.kind === 'forbidden') throw new ForbiddenException('Invalid reviewer');
      if (result.kind === 'missing') throw new NotFoundException('Trainer application not found');
      if (result.kind === 'conflict') {
        throw new ConflictException('Trainer application is no longer eligible for this decision');
      }

      this.audit.record({
        permission: 'admin.accounts.manage',
        actorId: reviewer.id,
        targetId: applicationId,
        outcome: 'allowed',
      });
      return result.record;
    } catch (error: unknown) {
      // Serializable collisions and profile uniqueness conflicts fail closed.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      ) {
        throw new ConflictException('Concurrent trainer application review');
      }
      throw error;
    }
  }
}
