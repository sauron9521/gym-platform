import { PasswordHasher } from '@nestjs/authentication';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { DistributedThrottlerStorage } from '#src/common/rate-limit/distributed-throttler.storage';
import { RATE_LIMIT_POLICIES } from '#src/common/rate-limit/rate-limit.policies';
import type { AccountDeletionRequestInput } from '../dto/account-deletion-request.dto.js';
import { AccountDeletionRequestsRepository } from '../repositories/account-deletion-requests.repository.js';

@Injectable()
export class AccountDeletionRequestsService {
  constructor(
    private readonly repository: AccountDeletionRequestsRepository,
    private readonly passwords: PasswordHasher,
    private readonly throttle: DistributedThrottlerStorage,
  ) {}

  async findOwn(userId: string) {
    const receipt = await this.repository.findOwn(userId);
    return { request: receipt && { ...receipt, status: 'REQUESTED' as const } };
  }

  async submit(userId: string, { password }: AccountDeletionRequestInput) {
    const policy = RATE_LIMIT_POLICIES.auth;
    const attempt = await this.throttle.increment(
      `account-deletion:${userId}`,
      policy.ttl,
      policy.limit,
      0,
      'account-deletion',
    );
    if (attempt.isBlocked) throw new ThrottlerException();

    const credentials = await this.repository.findConfirmationCredentials(userId);
    const passwordMatches = await this.passwords.verify(password, credentials?.passwordHash);
    if (!credentials || !passwordMatches) {
      throw new ForbiddenException('Account confirmation failed');
    }

    const receipt = await this.repository.submit(userId, credentials);
    if (!receipt) throw new ForbiddenException('Account confirmation failed');

    return { request: { ...receipt, status: 'REQUESTED' as const } };
  }
}
