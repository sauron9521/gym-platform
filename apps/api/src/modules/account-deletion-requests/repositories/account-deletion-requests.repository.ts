import { Injectable } from '@nestjs/common';
import { PrismaService } from '#src/infra/database/index';
import type { Prisma } from '#prisma/client';

const receiptSelect = {
  id: true,
  requestedAt: true,
} satisfies Prisma.AccountDeletionRequestSelect;

type VerifiedCredentials = {
  passwordHash: string;
  authInvalidatedAt: Date | null;
};

@Injectable()
export class AccountDeletionRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findConfirmationCredentials(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: { passwordHash: true, authInvalidatedAt: true },
    });
  }

  findOwn(userId: string) {
    return this.prisma.accountDeletionRequest.findUnique({
      where: { userId, user: { status: 'ACTIVE', deletedAt: null } },
      select: receiptSelect,
    });
  }

  async submit(userId: string, verified: VerifiedCredentials) {
    return this.prisma.$transaction(async (tx) => {
      // Recheck the verified credentials under the account lock. A concurrent
      // reset, suspension or duplicate submission must serialize with intake.
      const current = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users"
        WHERE "id" = ${userId}
          AND "status" = 'ACTIVE'
          AND "deleted_at" IS NULL
          AND "password_hash" = ${verified.passwordHash}
          AND "auth_invalidated_at" IS NOT DISTINCT FROM ${verified.authInvalidatedAt}::timestamptz
        FOR UPDATE
      `;
      if (current.length === 0) return null;

      return tx.accountDeletionRequest.upsert({
        where: { userId },
        create: { userId },
        update: {},
        select: receiptSelect,
      });
    });
  }
}
