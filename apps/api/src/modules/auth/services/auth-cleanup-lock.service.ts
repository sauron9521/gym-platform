import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import type { AppConfigService } from '#src/common/config/app-config.types';

// Separate from the email-token insert advisory lock. These keys belong
// exclusively to the global auth retention worker.
const AUTH_CLEANUP_LOCK_KEY = [1197030721, 2] as const;

/**
 * A session-level advisory lock requires a pinned PostgreSQL connection.
 * Prisma's pool does not guarantee the same session across independent queries,
 * and a single interactive Prisma transaction spanning many batches is unsafe.
 */
@Injectable()
export class AuthCleanupLockService {
  constructor(@Inject(ConfigService) private readonly config: AppConfigService) {}

  async runExclusive(work: () => Promise<void>): Promise<boolean> {
    const client = new Client({
      connectionString: this.config.getOrThrow('DATABASE_URL'),
      connectionTimeoutMillis: 5_000,
      application_name: 'gym-auth-cleanup-lock',
    });
    let connected = false;
    let acquired = false;

    try {
      await client.connect();
      connected = true;
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired',
        [...AUTH_CLEANUP_LOCK_KEY],
      );
      acquired = result.rows[0]?.acquired === true;
      if (!acquired) {
        return false;
      }

      await work();
      return true;
    } finally {
      try {
        if (acquired) {
          await client.query('SELECT pg_advisory_unlock($1::integer, $2::integer)', [
            ...AUTH_CLEANUP_LOCK_KEY,
          ]);
        }
      } finally {
        // Closing this dedicated connection also releases any session lock if
        // the unlock query fails. Never return the locked client to a pool.
        if (connected) {
          await client.end();
        }
      }
    }
  }
}
