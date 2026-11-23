import {
  AuthenticationRegistry,
  SessionCookieProvider,
  type SessionRecord,
} from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { UsersAuthFacade } from '#src/modules/users/services/users-auth.facade';
import type { UserResponse } from '#src/modules/users/types/user-payload.types';

@Injectable()
export class SessionAuth extends SessionCookieProvider<UserResponse> {
  constructor(
    private readonly usersRepository: UsersAuthFacade,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  validate(session: SessionRecord) {
    // Legacy admin-purpose tokens must never authorize the ordinary cookie realm.
    if (session.metadata?.purpose === 'admin') return null;
    return this.usersRepository.findUserById(session.userId);
  }
}
