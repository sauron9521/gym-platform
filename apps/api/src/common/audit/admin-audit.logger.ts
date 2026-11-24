import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';

import { getRequestId } from '../request-context/request-context.middleware.js';
import { ADMIN_PERMISSIONS } from '../rbac/admin-permissions.js';

/**
 * Logging-only contract, not a durable or complete compliance audit trail.
 * IDs are validated and pseudonymized (not anonymized) before logging.
 */
const auditInputSchema = z.strictObject({
  permission: z.enum(ADMIN_PERMISSIONS),
  actorId: z.uuid(),
  targetId: z.uuid().optional(),
  outcome: z.enum(['allowed', 'denied', 'failed']),
});

export type AdminAuditInput = z.infer<typeof auditInputSchema>;

function pseudonymize(kind: 'actor' | 'target', value: string): string {
  // Domain-separated hashes prevent actor/target hashes from being identical
  // when a user occurs in both positions. UUID hashes are still linkable.
  return createHash('sha256')
    .update('gym.admin.audit.v1:' + kind + ':' + value)
    .digest('hex');
}

@Injectable()
export class AdminAuditLogger {
  private readonly logger = new Logger(AdminAuditLogger.name);

  /**
   * Call only after server-side authentication/authorization. The caller must
   * supply the authenticated principal, not an ID from a request body/header.
   * An optional request is used only for server-generated request correlation.
   */
  record(input: AdminAuditInput, request?: Request): void {
    const event = auditInputSchema.parse(input);
    const requestId = request ? getRequestId(request) : undefined;

    // Do not log raw principals, targets, request payloads, errors or tokens.
    this.logger.log({
      event: 'ADMIN_AUDIT_EVENT',
      schemaVersion: 1,
      permission: event.permission,
      actorHash: pseudonymize('actor', event.actorId),
      ...(event.targetId ? { targetHash: pseudonymize('target', event.targetId) } : {}),
      ...(requestId ? { requestId } : {}),
      outcome: event.outcome,
    });
  }
}
