import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaSessionStore, PrismaTokenStore } from '../stores/index.js';
import { AuthCleanupLockService } from './auth-cleanup-lock.service.js';

// One statement deletes no more than 500 rows. Every batch commits separately,
// rather than accumulating row locks and FK-cascade work in one transaction.
const CLEANUP_BATCH_SIZE = 500;
// Protect DB capacity even if an unexpected backlog is enormous.
// The next nightly run resumes from remaining expired rows.
const MAX_BATCH_ROUNDS = 200;

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(
    private readonly tokenStore: PrismaTokenStore,
    private readonly sessionStore: PrismaSessionStore,
    private readonly lock: AuthCleanupLockService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    timeZone: 'Europe/Kyiv',
    waitForCompletion: true,
  })
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const acquired = await this.lock.runExclusive(async () => {
        const startedAt = Date.now();
        const cutoff = new Date();
        let refreshFamilies = 0;
        let emailTokens = 0;
        let sessions = 0;
        let complete = false;
        let rounds = 0;

        // Avoid concurrent full-table DELETEs; each ordered batch is small and
        // has its own PostgreSQL transaction, outside the advisory-lock client.
        for (let round = 0; round < MAX_BATCH_ROUNDS; round += 1) {
          const deletedFamilies = await this.tokenStore.deleteExpiredRefreshTokenFamiliesBatch(
            cutoff,
            CLEANUP_BATCH_SIZE,
          );
          const deletedEmail = await this.tokenStore.deleteExpiredEmailTokensBatch(
            cutoff,
            CLEANUP_BATCH_SIZE,
          );
          const deletedSessions = await this.sessionStore.deleteExpiredSessionsBatch(
            cutoff,
            CLEANUP_BATCH_SIZE,
          );

          refreshFamilies += deletedFamilies;
          emailTokens += deletedEmail;
          sessions += deletedSessions;
          rounds += 1;

          if (
            deletedFamilies < CLEANUP_BATCH_SIZE &&
            deletedEmail < CLEANUP_BATCH_SIZE &&
            deletedSessions < CLEANUP_BATCH_SIZE
          ) {
            complete = true;
            break;
          }
        }

        // Counts and timings are operational metrics only: never log token IDs,
        // user records, SQL exceptions, or connection configuration.
        const metrics = `refreshFamilies=${refreshFamilies} emailTokens=${emailTokens} sessions=${sessions} batches=${rounds} elapsedMs=${Date.now() - startedAt}`;
        if (complete) {
          this.logger.log(`AUTH_TOKEN_CLEANUP_COMPLETED ${metrics}`);
        } else {
          this.logger.warn(`AUTH_TOKEN_CLEANUP_LIMIT_REACHED ${metrics}`);
        }
      });

      if (!acquired) {
        this.logger.log('AUTH_TOKEN_CLEANUP_SKIPPED_LOCK_BUSY');
      }
    } catch {
      // Never log Prisma/pg errors, raw SQL, credentials, tokens or stack traces.
      this.logger.error('AUTH_TOKEN_CLEANUP_FAILED');
    }
  }
}
