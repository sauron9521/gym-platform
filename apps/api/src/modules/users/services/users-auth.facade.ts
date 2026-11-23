import { Injectable } from '@nestjs/common';

import { UsersRepository } from '../repositories/users.repository.js';

/**
 * The Users module's public provider contract for Authentication.
 *
 * Keep normalization, soft-delete/status gates, credential selects and the
 * JWT invalidation fence in UsersRepository. Auth must not reach that
 * repository directly or reimplement those persistence checks.
 */
@Injectable()
export class UsersAuthFacade {
  constructor(private readonly repository: UsersRepository) {}

  checkEmail(email: string) {
    return this.repository.checkEmail(email);
  }

  create(email: string, passwordHash: string) {
    return this.repository.create(email, passwordHash);
  }

  findCredentials(email: string) {
    return this.repository.findCredentials(email);
  }

  updatePassHash(id: string, passwordHash: string) {
    return this.repository.updatePassHash(id, passwordHash);
  }

  findUserForJwtAuth(id: string, issuedAt?: number) {
    return this.repository.findUserForJwtAuth(id, issuedAt);
  }

  findUserById(id: string) {
    return this.repository.findUserById(id);
  }

  getPreferredMailLocale(email: string) {
    return this.repository.getPreferredMailLocale(email);
  }

  markEmailVerified(userId: string, email: string) {
    return this.repository.markEmailVerified(userId, email);
  }
}
