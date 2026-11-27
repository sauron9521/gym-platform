import { Authenticate, CurrentUser } from '@nestjs/authentication';
import {
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { AdminCookieRoute } from '#src/common/auth/admin-cookie-route';
import { AdminSessionCookieProvider } from '#src/common/auth/admin-session-cookie.provider';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import {
  AdminNotificationInboxService,
  adminNotificationInboxQuerySchema,
  type AdminNotificationInboxQuery,
} from '#src/modules/notifications/public-api';
import {
  arraySchema,
  dateTimeSchema,
  integerSchema,
  nullable,
  objectSchema,
  stringSchema,
  uuidSchema,
} from '#src/infra/openapi/response-contracts';

const emptyQuery = z.strictObject({});
const notification = objectSchema({
  id: uuidSchema,
  type: { type: 'string', enum: ['admin.trainer.review.required'] },
  category: { type: 'string', enum: ['ACCOUNT'] },
  templateKey: { type: 'string', enum: ['admin.trainer.review.required'] },
  createdAt: dateTimeSchema,
  readAt: nullable(dateTimeSchema),
});
function assertOwner(userId: string, expectedOwner?: string) {
  if (expectedOwner !== undefined && expectedOwner !== userId)
    throw new ConflictException('Notification account changed');
}
const ApiInboxOwner = () =>
  ApiHeader({
    name: 'x-inbox-owner',
    required: false,
    description: 'Expected authenticated admin account ID; mismatch rejects before Inbox access.',
  });
@ApiTags('Admin notifications')
@ApiConflictResponse({ description: 'Expected account differs from authenticated admin account' })
@ApiCookieAuth('adminSessionCookie')
@Controller('admin/notifications')
@AdminCookieRoute()
@Authenticate({ providers: [AdminSessionCookieProvider] })
@UseGuards(AdminOriginGuard, AdminSessionPurposeGuard)
export class AdminNotificationInboxController {
  constructor(private readonly service: AdminNotificationInboxService) {}

  @Get()
  @ApiInboxOwner()
  @RateLimit('read')
  @ApiOkResponse({
    schema: objectSchema({ data: arraySchema(notification), nextCursor: nullable(stringSchema) }),
  })
  list(
    @CurrentUser('id') userId: string,
    @Query({ schema: adminNotificationInboxQuerySchema }) query: AdminNotificationInboxQuery,
    @Headers('x-inbox-owner') expectedOwner?: string,
  ) {
    assertOwner(userId, expectedOwner);
    return this.service.list(userId, query);
  }

  @Get('unread-count')
  @ApiInboxOwner()
  @RateLimit('read')
  @ApiOkResponse({ schema: objectSchema({ count: integerSchema }) })
  unreadCount(
    @CurrentUser('id') userId: string,
    @Query({ schema: emptyQuery }) _query: Record<string, never>,
    @Headers('x-inbox-owner') expectedOwner?: string,
  ) {
    assertOwner(userId, expectedOwner);
    return this.service.unreadCount(userId);
  }

  @Get(':id')
  @ApiInboxOwner()
  @RateLimit('read')
  @ApiOkResponse({ schema: notification })
  detail(
    @CurrentUser('id') userId: string,
    @Param('id', { schema: z.uuid() }) id: string,
    @Query({ schema: emptyQuery }) _query: Record<string, never>,
    @Headers('x-inbox-owner') expectedOwner?: string,
  ) {
    assertOwner(userId, expectedOwner);
    return this.service.detail(userId, id);
  }

  @Patch(':id/read')
  @ApiInboxOwner()
  @ApiOkResponse({ schema: notification })
  markRead(
    @CurrentUser('id') userId: string,
    @Param('id', { schema: z.uuid() }) id: string,
    @Query({ schema: emptyQuery }) _query: Record<string, never>,
    @Headers('x-inbox-owner') expectedOwner?: string,
  ) {
    assertOwner(userId, expectedOwner);
    return this.service.markRead(userId, id);
  }

  @Post('read-all')
  @ApiInboxOwner()
  @HttpCode(204)
  @ApiNoContentResponse()
  markAllRead(
    @CurrentUser('id') userId: string,
    @Query({ schema: emptyQuery }) _query: Record<string, never>,
    @Headers('x-inbox-owner') expectedOwner?: string,
  ) {
    assertOwner(userId, expectedOwner);
    return this.service.markAllRead(userId);
  }
}
