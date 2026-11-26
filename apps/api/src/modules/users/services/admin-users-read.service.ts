import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { hasAdminPermission } from '#src/common/rbac/admin-permissions';
import { parseOperatorSuperAdminIds } from '#src/common/rbac/operator-superadmin-allowlist';

import type { AdminUsersQuery } from '../dto/admin-users-query.dto.js';
import { UsersRepository } from '../repositories/users.repository.js';

export type AdminUsersReadActor = {
  id: string;
  role: 'ATHLETE' | 'TRAINER' | 'ADMIN';
};

/** Narrow privileged directory read boundary. The caller supplies the authenticated actor. */
@Injectable()
export class AdminUsersReadService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly config: ConfigService,
  ) {}

  private assertOperator(actor: AdminUsersReadActor): void {
    const elevated = parseOperatorSuperAdminIds(this.config.get('SUPERADMIN_USER_IDS'));
    if (!actor?.id || !hasAdminPermission(actor.role, 'admin.accounts.read', actor.id, elevated)) {
      throw new ForbiddenException('Insufficient administrative permissions');
    }
  }

  listForAdmin(query: AdminUsersQuery, actor: AdminUsersReadActor) {
    this.assertOperator(actor);
    return this.repository.listForAdmin(query);
  }

  findForAdminDetails(userId: string, actor: AdminUsersReadActor) {
    this.assertOperator(actor);
    return this.repository.findForAdminDetails(userId);
  }
}
