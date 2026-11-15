import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { AuthCleanupLockService } from '../../services/auth-cleanup-lock.service.js';

const pg = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
  construct: vi.fn(),
}));

vi.mock('pg', () => ({
  Client: class {
    constructor(options: unknown) {
      pg.construct(options);
    }
    connect = pg.connect;
    query = pg.query;
    end = pg.end;
  },
}));

describe('AuthCleanupLockService', () => {
  const dbUrl = 'postgresql://postgres:password@localhost:5432/gym_auth_test';
  const config = { getOrThrow: vi.fn() };
  let lock: AuthCleanupLockService;

  beforeEach(() => {
    vi.resetAllMocks();
    config.getOrThrow.mockReturnValue(dbUrl);
    pg.connect.mockResolvedValue(undefined);
    pg.end.mockResolvedValue(undefined);
    pg.query.mockResolvedValue({ rows: [{ acquired: true }] });
    lock = new AuthCleanupLockService(config as unknown as AppConfigService);
  });

  it('pins the lock to one connection, then unlocks and closes after successful work', async () => {
    const events: string[] = [];
    pg.connect.mockImplementation(async () => {
      events.push('connect');
    });
    pg.query.mockImplementation(async (sql: string) => {
      events.push(sql.includes('pg_try_advisory_lock') ? 'lock' : 'unlock');
      return { rows: [{ acquired: true }] };
    });
    pg.end.mockImplementation(async () => {
      events.push('end');
    });
    const work = vi.fn(async () => {
      events.push('work');
    });

    await expect(lock.runExclusive(work)).resolves.toBe(true);

    expect(config.getOrThrow).toHaveBeenCalledExactlyOnceWith('DATABASE_URL');
    expect(pg.construct).toHaveBeenCalledExactlyOnceWith({
      connectionString: dbUrl,
      connectionTimeoutMillis: 5_000,
      application_name: 'gym-auth-cleanup-lock',
    });
    expect(pg.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired',
      [1197030721, 2],
    );
    expect(pg.query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_unlock($1::integer, $2::integer)',
      [1197030721, 2],
    );
    expect(events).toEqual(['connect', 'lock', 'work', 'unlock', 'end']);
    expect(work).toHaveBeenCalledOnce();
    expect(pg.end).toHaveBeenCalledOnce();
  });

  it.each([{ rows: [{ acquired: false }] }, { rows: [] }])(
    'does not execute work or unlock if the advisory lock is unavailable: %j',
    async (result) => {
      pg.query.mockResolvedValueOnce(result);
      const work = vi.fn();

      await expect(lock.runExclusive(work)).resolves.toBe(false);

      expect(work).not.toHaveBeenCalled();
      expect(pg.query).toHaveBeenCalledOnce();
      expect(pg.end).toHaveBeenCalledOnce();
    },
  );

  it('propagates a connection failure without running the job or querying the DB', async () => {
    const failure = new Error('Connection rejected');
    pg.connect.mockRejectedValueOnce(failure);
    const work = vi.fn();

    await expect(lock.runExclusive(work)).rejects.toBe(failure);

    expect(work).not.toHaveBeenCalled();
    expect(pg.query).not.toHaveBeenCalled();
    expect(pg.end).not.toHaveBeenCalled();
  });

  it('closes the pinned connection if acquiring the lock throws', async () => {
    const failure = new Error('Advisory lock query failed');
    pg.query.mockRejectedValueOnce(failure);
    const work = vi.fn();

    await expect(lock.runExclusive(work)).rejects.toBe(failure);

    expect(work).not.toHaveBeenCalled();
    expect(pg.query).toHaveBeenCalledOnce();
    expect(pg.end).toHaveBeenCalledOnce();
  });

  it('releases the advisory lock and closes the connection when the job throws', async () => {
    const failure = new Error('Expired-token cleanup failed');
    const work = vi.fn().mockRejectedValueOnce(failure);

    await expect(lock.runExclusive(work)).rejects.toBe(failure);

    expect(work).toHaveBeenCalledOnce();
    expect(pg.query).toHaveBeenCalledTimes(2);
    expect(pg.query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock($1::integer, $2::integer)',
      [1197030721, 2],
    );
    expect(pg.end).toHaveBeenCalledOnce();
  });

  it('closes the dedicated connection even if the unlock query fails', async () => {
    const failure = new Error('Advisory unlock failed');
    pg.query
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockRejectedValueOnce(failure);
    const work = vi.fn().mockResolvedValue(undefined);

    await expect(lock.runExclusive(work)).rejects.toBe(failure);

    expect(work).toHaveBeenCalledOnce();
    expect(pg.end).toHaveBeenCalledOnce();
  });

  it('does not swallow a connection-close error after successfully unlocking', async () => {
    const failure = new Error('Closing lock connection failed');
    pg.end.mockRejectedValueOnce(failure);
    const work = vi.fn().mockResolvedValue(undefined);

    await expect(lock.runExclusive(work)).rejects.toBe(failure);

    expect(work).toHaveBeenCalledOnce();
    expect(pg.query).toHaveBeenCalledTimes(2);
    expect(pg.end).toHaveBeenCalledOnce();
  });
});
