import { Public, SignInService } from '@nestjs/authentication';
import { Controller, HttpCode, Post, UnauthorizedException, UseInterceptors } from '@nestjs/common';
import { AuthNoStoreInterceptor } from '#src/modules/auth/public-api';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';

@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth')
export class SignOutController {
  constructor(private readonly signInService: SignInService) {}

  // Public so that a pending-MFA session can also be signed out.
  @Public()
  @StableHttpOperation('SessionsController', 'signOut', 'Sessions')
  @Post('sign-out')
  @HttpCode(204)
  async signOut(): Promise<void> {
    if (!(await this.signInService.signOut())) {
      throw new UnauthorizedException();
    }
  }
}
