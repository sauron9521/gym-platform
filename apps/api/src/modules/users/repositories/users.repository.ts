import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminUsersQuery } from '../dto/admin-users-query.dto.js';
import { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';

import {
  profileAvatarOwnerSelect,
  userAvatarKeySelect,
  adminUserListSelect,
  adminUserDetailSelect,
  userEmailVerificationSelect,
  userSelect,
  userSelectWithCredentials,
  userWithProfileSelect,
} from '../selects/user.select.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Super-admin-only read projection. No credentials, profile or deletion metadata. */
  async listForAdmin(query: AdminUsersQuery) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { email: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
            },
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: adminUserListSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        skip,
        take: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /** Explicitly allowlisted operator details; never select credentials or profile data. */
  async findForAdminDetails(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: adminUserDetailSelect,
    });
    return user;
  }

  async create(email: string, passwordHash: string) {
    try {
      return await this.prisma.user.create({
        data: {
          email: normalizeEmail(email),
          passwordHash,
        },
        select: userSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User with the same email already exists');
      }

      throw error;
    }
  }

  /** Re-read persisted privilege state: sessions never decide capabilities. */
  async findCapabilitySnapshot(id: string) {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null, status: 'ACTIVE' },
      select: {
        role: true,
        trainerProfile: { select: { isActive: true } },
      },
    });
  }

  async findMe(id: string) {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null, status: 'ACTIVE' },
      select: userWithProfileSelect,
    });
  }

  /** A null preference returns locale selection to the device/browser. */
  async updateMyPreferences(userId: string, preferredLocale: 'uk' | 'en' | null) {
    try {
      return await this.prisma.user.update({
        where: { id: userId, deletedAt: null, status: 'ACTIVE' },
        data: { preferredLocale },
        select: userWithProfileSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  async upsertMyProfile(userId: string, data: Prisma.ProfileCreateWithoutUserInput) {
    try {
      // One atomic upsert, safe when two requests create a missing profile.
      return await this.prisma.user.update({
        where: { id: userId, deletedAt: null, status: 'ACTIVE' },
        data: {
          profile: {
            upsert: { create: data, update: data },
          },
        },
        select: userWithProfileSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  /**
   * Row-lock the user before changing an avatar reference.
   * Concurrent uploads, deletes and legacy avatarUrl PATCHes serialize
   * through this lock; the caller deletes the old managed blob after commit.
   */
  async replaceAvatar(
    userId: string,
    data: Prisma.ProfileCreateWithoutUserInput,
    avatarKey: string | null,
    skipMissingProfile = false,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users"
        WHERE "id" = ${userId} AND "deleted_at" IS NULL AND "status" = 'ACTIVE'
        FOR UPDATE
      `;

      if (rows.length !== 1) {
        throw new NotFoundException('User not found');
      }

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: userAvatarKeySelect,
      });
      const previousKey = current?.profile?.avatarKey ?? null;

      // DELETE on a user without a profile must not create a blank row.
      if (skipMissingProfile && !current?.profile) {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: userWithProfileSelect,
        });
        return { user, previousKey };
      }

      const user = await tx.user.update({
        where: { id: userId, deletedAt: null, status: 'ACTIVE' },
        data: {
          profile: {
            upsert: {
              create: { ...data, avatarKey },
              update: { ...data, avatarKey },
            },
          },
        },
        select: userWithProfileSelect,
      });

      return { user, previousKey };
    });
  }

  /** Public image lookup: exposes no account data, blocks orphaned keys. */
  async isCurrentAvatar(key: string): Promise<boolean> {
    const profile = await this.prisma.profile.findUnique({
      where: { avatarKey: key },
      select: profileAvatarOwnerSelect,
    });

    return Boolean(profile && profile.user.deletedAt === null && profile.user.status === 'ACTIVE');
  }

  /** Transactional mail uses the persisted account setting, not link/query language hints. */
  async getPreferredMailLocale(email: string): Promise<'uk' | 'en'> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email), deletedAt: null, status: 'ACTIVE' },
      select: { preferredLocale: true },
    });
    return user?.preferredLocale === 'en' ? 'en' : 'uk';
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: userSelect,
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null, status: 'ACTIVE' },
      select: userSelect,
    });
  }

  async findCredentials(email: string) {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email), deletedAt: null, status: 'ACTIVE' },
      select: userSelectWithCredentials,
    });
  }

  async updatePassHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id, deletedAt: null, status: 'ACTIVE' },
      data: { passwordHash },
      select: userSelect,
    });
  }

  // relocation SERVICE AUTH?
  async checkEmail(email: string): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (user) {
      throw new ConflictException('User with the same email already exists');
    }
  }

  // relocation SERVICE AUTH?
  async markEmailVerified(userId: string, email: string): Promise<boolean> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException();
    }

    if (user.email !== email) {
      return false;
    }
    await this.prisma.user.update({
      where: { id: userId, deletedAt: null, status: 'ACTIVE' },
      data: { emailVerified: true },
      select: userEmailVerificationSelect,
    });
    return true;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}
