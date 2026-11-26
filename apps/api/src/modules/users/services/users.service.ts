import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '#prisma/client';

import { AvatarService } from '../avatar/avatar.service.js';
import type { UpdateMyProfileDto } from '../dto/update-my-profile.dto.js';
import type { UpdateMyWorkoutPreferencesDto } from '../dto/update-my-workout-preferences.dto.js';
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

  /** Internal authorization facade: no role claims or client flags are trusted. */
  async hasTrainerCapability(userId: string): Promise<boolean> {
    const account = await this.usersRepository.findCapabilitySnapshot(userId);
    return account !== null && deriveAccountCapabilities(account).trainer;
  }

  /**
   * Final authorization checkpoint for a write inside the caller's transaction.
   * User/Profile locks acquired by the repository remain held until COMMIT, so
   * revocation and the guarded write are serialized. Reuse the SAME capability
   * derivation as the normal read facade, never a duplicated SQL role rule.
   */
  async assertTrainerCapabilityForWrite(tx: Prisma.TransactionClient, userId: string) {
    const account = await this.usersRepository.findCapabilitySnapshotForWrite(tx, userId);
    if (!account || !deriveAccountCapabilities(account).trainer) {
      throw new ForbiddenException('Only active trainers can modify training programs');
    }
  }

  /** A held User/Profile row-lock snapshot for a caller's write transaction. */
  async findMyCapabilitiesForWrite(tx: Prisma.TransactionClient, userId: string) {
    const account = await this.usersRepository.findCapabilitySnapshotForWrite(tx, userId);
    if (!account) throw new NotFoundException('User not found');
    return deriveAccountCapabilities(account);
  }

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

  async findMyWorkoutPreferences(userId: string) {
    const preferences = await this.usersRepository.findMyWorkoutPreferences(userId);
    if (!preferences) throw new NotFoundException('User not found');
    return preferences;
  }

  async updateMyWorkoutPreferences(userId: string, input: UpdateMyWorkoutPreferencesDto) {
    return this.usersRepository.updateMyWorkoutPreferences(userId, input);
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
