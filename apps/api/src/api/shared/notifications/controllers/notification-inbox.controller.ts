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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import {
  NotificationInboxService,
  inboxEventTypes,
  notificationInboxQuerySchema,
  type NotificationInboxQuery,
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
const baseNotification = objectSchema({
  id: uuidSchema,
  type: { type: 'string', enum: [...inboxEventTypes] },
  category: { type: 'string', enum: ['ACCOUNT', 'TRAINER', 'PROGRAM'] },
  templateKey: { type: 'string', enum: [...inboxEventTypes] },
  createdAt: dateTimeSchema,
  readAt: nullable(dateTimeSchema),
});
const notification = {
  ...baseNotification,
  properties: {
    ...baseNotification.properties,
    target: objectSchema({
      kind: { type: 'string', enum: ['PROGRAM_ASSIGNMENT'] },
      id: uuidSchema,
    }),
  },
};

// An optional cache-owner fence is not an authentication credential. The
// authenticated principal remains the only recipient passed to the service.
function assertExpectedOwner(userId: string, expectedOwner?: string) {
  if (expectedOwner !== undefined && expectedOwner !== userId) {
    throw new ConflictException('Notification account changed');
  }
}

const ApiInboxOwner = () =>
  ApiHeader({
    name: 'x-inbox-owner',
    required: false,
    description:
      'Expected authenticated account ID; mismatch rejects the request before any Inbox access.',
  });

@ApiTags('Notifications')
@ApiConflictResponse({ description: 'Expected account differs from authenticated account' })
@ApiCookieAuth('sessionCookie')
@ApiBearerAuth('accessToken')
@Controller('notifications')
@Authenticate()
export class NotificationInboxController {
  constructor(private readonly service: NotificationInboxService) {}

  @Get()
  @ApiInboxOwner()
  @RateLimit('read')
  @ApiOkResponse({
    schema: objectSchema({ data: arraySchema(notification), nextCursor: nullable(stringSchema) }),
  })
  list(
    @CurrentUser('id') userId: string,
    @Query({ schema: notificationInboxQuerySchema }) query: NotificationInboxQuery,
    @Headers('x-inbox-owner') expectedOwner?: string,
  ) {
    assertExpectedOwner(userId, expectedOwner);
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
    assertExpectedOwner(userId, expectedOwner);
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
    assertExpectedOwner(userId, expectedOwner);
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
    assertExpectedOwner(userId, expectedOwner);
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
    assertExpectedOwner(userId, expectedOwner);
    return this.service.markAllRead(userId);
  }
}
