import { AuthenticationRegistry, JwtBearerProvider, type JwtClaims } from '@nestjs/authentication';
import { UsersAuthFacade } from '#src/modules/users/services/users-auth.facade';
import { Injectable } from '@nestjs/common';
import type { UserResponse } from '#src/modules/users/types/user-payload.types';

@Injectable()
export class JwtAuth extends JwtBearerProvider<UserResponse> {
  constructor(
    private readonly usersRepository: UsersAuthFacade,
    registry: AuthenticationRegistry,
  ) {
    super({ realm: 'store' });
    registry.registerProvider(this, { order: 1 });
  }

  validate({ sub, iat }: JwtClaims) {
    return sub ? this.usersRepository.findUserForJwtAuth(sub, iat) : null;
  }
}
