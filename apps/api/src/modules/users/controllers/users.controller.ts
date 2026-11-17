import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Delete,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AvatarService } from '../avatar/avatar.service.js';
import type { AvatarUploadFile } from '../avatar/avatar-validation.js';
import { MAX_AVATAR_SIZE } from '../avatar/avatar-validation.js';
import { Authenticate, CurrentUser } from '@nestjs/authentication';

import { UsersService } from '../services/users.service.js';
import { type UpdateMyProfileDto, updateMyProfileSchema } from '../dto/update-my-profile.dto.js';
import {
  type UpdateMyPreferencesDto,
  updateMyPreferencesSchema,
} from '../dto/update-my-preferences.dto.js';

type UserActor = { id: string };

@ApiTags('Users')
@ApiCookieAuth('sessionCookie')
@ApiBearerAuth('accessToken')
@Controller('users')
@Authenticate()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly avatarService: AvatarService,
  ) {}

  @Get('me')
  // Server route guards and browser profile reads share this endpoint. Normal
  // navigation must not exhaust the stricter default mutation budget.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOkResponse({
    description: 'Authenticated account and nullable profile. Never includes credentials.',
    schema: {
      type: 'object',
      required: [
        'id',
        'email',
        'emailVerified',
        'role',
        'preferredLocale',
        'createdAt',
        'updatedAt',
        'profile',
      ],
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        emailVerified: { type: 'boolean' },
        role: { type: 'string', enum: ['ATHLETE', 'TRAINER', 'ADMIN'] },
        preferredLocale: { type: 'string', enum: ['uk', 'en'], nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        profile: {
          type: 'object',
          nullable: true,
          properties: {
            name: { type: 'string', nullable: true },
            firstName: { type: 'string', nullable: true },
            lastName: { type: 'string', nullable: true },
            displayName: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            timezone: { type: 'string' },
            birthday: { type: 'string', format: 'date', nullable: true },
            height: { type: 'integer', nullable: true },
            weight: { type: 'number', nullable: true },
          },
        },
      },
    },
  })
  me(@CurrentUser() user: UserActor) {
    return this.usersService.findMe(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: UserActor,
    @Body({ schema: updateMyProfileSchema })
    body: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMe(user.id, body);
  }
  /** Locale preference is account-scoped, not a mutable personal profile attribute. */
  @Patch('me/preferences')
  updatePreferences(
    @CurrentUser() user: UserActor,
    @Body({ schema: updateMyPreferencesSchema }) body: UpdateMyPreferencesDto,
  ) {
    return this.usersService.updateMyPreferences(user.id, body);
  }

  /** Multipart field: file. Returns the versioned, API-relative avatar URL. */
  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_AVATAR_SIZE,
        files: 1,
        fields: 0,
        parts: 1,
      },
    }),
  )
  uploadAvatar(@CurrentUser() user: UserActor, @UploadedFile() file?: AvatarUploadFile) {
    return this.avatarService.upload(user.id, file);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  deleteAvatar(@CurrentUser() user: UserActor) {
    return this.avatarService.delete(user.id);
  }
}
