import { Injectable, NotFoundException } from '@nestjs/common';

import { AvatarService } from '../avatar/avatar.service.js';
import type { UpdateMyProfileDto } from '../dto/update-my-profile.dto.js';
import type { UpdateMyPreferencesDto } from '../dto/update-my-preferences.dto.js';
import { mapProfileUpdateInput, mapUserWithProfile } from '../mappers/user-profile.mapper.js';
import { UsersRepository } from '../repositories/users.repository.js';
import { deriveAccountCapabilities } from '../policies/account-capabilities.policy.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly avatarService: AvatarService,
  ) {}

  /** Uses a fresh DB projection so moderation/revocation takes effect on the next read. */
  async findMyCapabilities(userId: string) {
    const account = await this.usersRepository.findCapabilitySnapshot(userId);
    if (!account) throw new NotFoundException('User not found');
    return deriveAccountCapabilities(account);
  }

  async findMe(userId: string) {
    const user = await this.usersRepository.findMe(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return mapUserWithProfile(user);
  }

  async updateMyPreferences(userId: string, input: UpdateMyPreferencesDto) {
    const user = await this.usersRepository.updateMyPreferences(userId, input.preferredLocale);
    return mapUserWithProfile(user);
  }

  async updateMe(userId: string, input: UpdateMyProfileDto) {
    const data = mapProfileUpdateInput(input);

    if (input.avatarUrl !== undefined) {
      // A legacy HTTPS URL PATCH must release any managed avatar it replaces.
      const result = await this.usersRepository.replaceAvatar(userId, data, null);
      await this.avatarService.removePrevious(result.previousKey);
      return mapUserWithProfile(result.user);
    }

    const user = await this.usersRepository.upsertMyProfile(userId, data);
    return mapUserWithProfile(user);
  }
}
