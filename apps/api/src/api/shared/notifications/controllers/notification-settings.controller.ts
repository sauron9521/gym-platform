import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Headers,
  Patch,
  Query,
} from '@nestjs/common';
import { Authenticate, CurrentUser } from '@nestjs/authentication';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import {
  notificationSettingsPatchSchema,
  reminderLeadMinutes,
  type NotificationSettingsPatch,
  NotificationSettingsService,
} from '#src/modules/notifications/public-api';

const emptyQuery = z.strictObject({});
const preference = (categories: string[], channel: string) => ({
  type: 'object' as const,
  additionalProperties: false,
  required: ['category', 'channel', 'enabled', 'consentedAt'],
  properties: {
    category: { type: 'string' as const, enum: categories },
    channel: { type: 'string' as const, enum: [channel] },
    enabled: { type: 'boolean' as const },
    consentedAt: { type: 'string' as const, format: 'date-time', nullable: true },
  },
});
const response = {
  description:
    'Account preferences; consent does not imply delivery or OS permission. Null timezone means invalid stored timezone.',
  schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: [
      'quietHoursEnabled',
      'quietStartMinute',
      'quietEndMinute',
      'reminderLeadMinutes',
      'timezone',
      'preferences',
    ],
    properties: {
      quietHoursEnabled: { type: 'boolean' as const },
      quietStartMinute: { type: 'integer' as const, minimum: 0, maximum: 1439 },
      quietEndMinute: { type: 'integer' as const, minimum: 0, maximum: 1439 },
      reminderLeadMinutes: { type: 'integer' as const, enum: [...reminderLeadMinutes] },
      timezone: { type: 'string' as const, nullable: true },
      preferences: {
        type: 'array' as const,
        minItems: 4,
        maxItems: 4,
        items: {
          oneOf: [
            preference(['TRAINER', 'PROGRAM'], 'MOBILE_PUSH'),
            preference(['WORKOUT'], 'LOCAL_REMINDER'),
            preference(['ACCOUNT'], 'EMAIL'),
          ],
        },
      },
    },
  },
};

function assertOwner(id: string, expected?: string) {
  if (expected !== undefined && expected !== id)
    throw new ConflictException('Notification account changed');
}

const ApiSettingsOwner = () =>
  ApiHeader({
    name: 'x-notification-owner',
    required: false,
    description: 'Expected authenticated account ID; mismatch rejects settings access.',
  });

@ApiTags('Notifications')
@ApiConflictResponse({ description: 'Expected account differs from authenticated account' })
@ApiCookieAuth('sessionCookie')
@ApiBearerAuth('accessToken')
@Controller('users/me/notification-settings')
@Authenticate()
export class NotificationSettingsController {
  constructor(private readonly service: NotificationSettingsService) {}

  @Get()
  @ApiSettingsOwner()
  @RateLimit('read')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse(response)
  get(
    @CurrentUser() user: { id: string },
    @Query({ schema: emptyQuery }) _query: Record<string, never>,
    @Headers('x-notification-owner') expectedOwner?: string,
  ) {
    assertOwner(user.id, expectedOwner);
    return this.service.get(user.id);
  }

  @Patch()
  @ApiSettingsOwner()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse(response)
  patch(
    @CurrentUser() user: { id: string },
    @Body({ schema: notificationSettingsPatchSchema }) body: NotificationSettingsPatch,
    @Query({ schema: emptyQuery }) _query: Record<string, never>,
    @Headers('x-notification-owner') expectedOwner?: string,
  ) {
    assertOwner(user.id, expectedOwner);
    return this.service.patch(user.id, body);
  }
}
