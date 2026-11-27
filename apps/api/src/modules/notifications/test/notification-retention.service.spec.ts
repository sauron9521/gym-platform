import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '#src/common/config/env.schema';
import type { NotificationRetentionRepository } from '../repositories/notification-retention.repository.js';
import { NotificationRetentionService } from '../services/notification-retention.service.js';

describe('NotificationRetentionService', () => {
  function setup(mode?: AppEnv['NOTIFICATION_RETENTION_MODE']) {
    const repo = { run: vi.fn().mockResolvedValue({ mode, acquired: true, inbox: 2, email: 1 }) };
    return {
      repo,
      service: new NotificationRetentionService(
        repo as unknown as NotificationRetentionRepository,
        new ConfigService<AppEnv, true>({ NOTIFICATION_RETENTION_MODE: mode }),
      ),
    };
  }
  afterEach(() => vi.restoreAllMocks());
  it('does not access retention repository by default or after shutdown', async () => {
    for (const mode of [undefined, 'off', 'invalid' as never] as const) {
      const { repo, service } = setup(mode);
      await service.cleanup();
      expect(repo.run).not.toHaveBeenCalled();
    }
    const { repo, service } = setup('apply');
    service.onModuleDestroy();
    await service.cleanup();
    expect(repo.run).not.toHaveBeenCalled();
  });
  it.each(['preview', 'apply'] as const)(
    'runs only explicitly selected %s and emits aggregate counts',
    async (mode) => {
      const { repo, service } = setup(mode);
      const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      await service.cleanup();
      expect(repo.run).toHaveBeenCalledExactlyOnceWith(mode);
      expect(log).toHaveBeenCalledExactlyOnceWith({
        event: 'NOTIFICATION_RETENTION_BATCH',
        mode,
        acquired: true,
        inbox: 2,
        email: 1,
      });
    },
  );
  it('redacts errors and does not retry immediately', async () => {
    const { repo, service } = setup('apply');
    repo.run.mockRejectedValueOnce(new Error('private recipient details'));
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await service.cleanup();
    expect(repo.run).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledExactlyOnceWith('NOTIFICATION_RETENTION_BATCH_FAILED');
  });
});
