import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '#prisma/client';

/**
 * Serialize all credential inserts against account transitions.
 * Must run in the SAME transaction as the insert, locking users before
 * any refresh family row. Never replace with a nonlocking findUnique.
 */
export async function lockActiveCredentialOwner(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "users"
    WHERE "id" = ${userId} AND "deleted_at" IS NULL AND "status" = 'ACTIVE'
    FOR UPDATE
  `;
  if (rows.length !== 1) throw new UnauthorizedException('Account unavailable');
}
