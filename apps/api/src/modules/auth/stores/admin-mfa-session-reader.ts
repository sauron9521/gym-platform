import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfigService } from '#src/common/config/app-config.types';
import { isAdminSessionExpired } from '#src/common/auth/admin-session-lifetime.policy';
import { PrismaService } from '#src/infra/database/index';
import { toSessionRecord } from '../mappers/auth-session.mapper.js';
import { authSessionSelect } from '../selects/auth-session.select.js';
import { ADMIN_MFA_PENDING_TTL_MS } from './admin-mfa-transaction-session.store.js';
import {
  adminMfaSessionScope,
  isCurrentRecoveryGrant,
  readAdminMfaAssurance,
} from './admin-mfa-session-scope.js';

const enrolledAdmin = {
  role: 'ADMIN',
  status: 'ACTIVE',
  deletedAt: null,
  mfaAuthenticator: { is: { confirmed: true } },
} as const;

/** Only the dedicated Admin cookie realm may call this reader. */
@Injectable()
export class AdminMfaSessionReader {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  async read(id: string) {
    if (!this.config.get('MFA_ENCRYPTION_KEYS')) return null;
    const scope = adminMfaSessionScope(id);
    const row = await this.prisma.session.findFirst({
      where: { ...scope, user: enrolledAdmin },
      select: { ...authSessionSelect, user: { select: { authInvalidatedAt: true } } },
    });
    if (!row) return null;
    const record = toSessionRecord(row);
    const now = Date.now();
    const fence = row.user.authInvalidatedAt;
    const assurance = readAdminMfaAssurance(record);
    if (!assurance || isAdminSessionExpired(record, now)) return null;
    // Recovery is an isolated grant bound to its own revocation epoch.
    // It is never accepted by the normal Admin authentication provider.
    if (assurance === 'recovery') {
      return isCurrentRecoveryGrant(record, fence, now) ? record : null;
    }
    if (
      (fence && record.createdAt <= fence) ||
      (record.mfa === 'pending' && now >= record.createdAt.getTime() + ADMIN_MFA_PENDING_TTL_MS)
    ) {
      return null;
    }

    // Pending challenges are absolute-only and never slide. A verified
    // session must still exist and retain its owner/factor state at touch.
    if (record.mfa === 'verified' && now - record.lastActiveAt.getTime() >= 60_000) {
      const lastActiveAt = new Date(now);
      const touched = await this.prisma.session.updateMany({
        where: {
          ...scope,
          mfa: 'verified',
          userId: record.userId,
          createdAt: record.createdAt,
          expiresAt: { gt: lastActiveAt },
          lastActiveAt: record.lastActiveAt,
          user: { ...enrolledAdmin, authInvalidatedAt: fence },
        },
        data: { lastActiveAt },
      });
      if (touched.count !== 1) return null;
      record.lastActiveAt = lastActiveAt;
    }
    return record;
  }

  /** Exact token only; never revoke an ordinary session or another device. */
  async discard(id: string): Promise<boolean> {
    const deleted = await this.prisma.session.deleteMany({ where: adminMfaSessionScope(id) });
    return deleted.count === 1;
  }
}
