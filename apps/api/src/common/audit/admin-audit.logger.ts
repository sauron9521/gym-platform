import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { ADMIN_PERMISSIONS, type AdminPermission } from '../rbac/admin-permissions.js';

export type AdminAuditOutcome = 'allowed' | 'denied' | 'failed';
export type AdminAuditInput = {
  permission: AdminPermission;
  actorId: string;
  targetId?: string;
  requestId?: string;
  outcome: AdminAuditOutcome;
};

/** Safe structured event stream for future administrative write endpoints. */
@Injectable()
export class AdminAuditLogger {
  private readonly logger = new Logger(AdminAuditLogger.name);

  record(input: AdminAuditInput): void {
    if (!ADMIN_PERMISSIONS.includes(input.permission)) {
      throw new Error('Unknown administrative audit action');
    }
    if (!['allowed', 'denied', 'failed'].includes(input.outcome)) {
      throw new Error('Unknown administrative audit outcome');
    }
    if (!input.actorId || input.actorId.length > 128) {
      throw new Error('Invalid administrative audit principal');
    }

    const pseudonym = (value: string) => createHash('sha256').update(value).digest('hex');

    // No user IDs, email addresses, access tokens, request bodies or raw errors
    // enter this log. The future durable store must enforce stricter retention.
    this.logger.log({
      event: 'ADMIN_AUDIT_EVENT',
      schemaVersion: 1,
      permission: input.permission,
      actorHash: pseudonym(input.actorId),
      ...(input.targetId ? { targetHash: pseudonym(input.targetId) } : {}),
      ...(input.requestId && /^[a-zA-Z0-9._:-]{1,64}$/.test(input.requestId)
        ? { requestId: input.requestId }
        : {}),
      outcome: input.outcome,
    });
  }
}
