import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import {
  accountDeletionReceiptResponseSchema,
  accountDeletionStatusResponseSchema,
} from '#src/infra/openapi/response-contracts';
import {
  type AccountDeletionRequestInput,
  accountDeletionRequestSchema,
  AccountDeletionRequestsService,
} from '../public-api.js';

@ApiTags('Users')
@ApiCookieAuth('sessionCookie')
@ApiBearerAuth('accessToken')
@Controller('users/me/account-deletion-request')
@Authenticate()
export class AccountDeletionRequestsController {
  constructor(private readonly requests: AccountDeletionRequestsService) {}

  @Get()
  @RateLimit('read')
  @ApiOkResponse({ schema: accountDeletionStatusResponseSchema })
  findOwn(@CurrentUser('id') userId: string) {
    return this.requests.findOwn(userId);
  }

  @Post()
  @HttpCode(200)
  @RateLimit('auth')
  @ApiOkResponse({ schema: accountDeletionReceiptResponseSchema })
  submit(
    @CurrentUser('id') userId: string,
    @Body({ schema: accountDeletionRequestSchema }) input: AccountDeletionRequestInput,
  ) {
    return this.requests.submit(userId, input);
  }
}
