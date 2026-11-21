import { Injectable } from '@nestjs/common';

import { PrismaService } from '#src/infra/database/index';

import { trainerApplicationOwnSelect } from '../selects/trainer-application.select.js';

@Injectable()
export class TrainerApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findApplicant(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        role: true,
        emailVerified: true,
        trainerProfile: { select: { isActive: true } },
      },
    });
  }

  findLatest(userId: string) {
    return this.prisma.trainerApplication.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: trainerApplicationOwnSelect,
    });
  }

  findBlocking(userId: string) {
    return this.prisma.trainerApplication.findFirst({
      where: { userId, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true, status: true },
    });
  }

  findPendingId(userId: string) {
    return this.prisma.trainerApplication.findFirst({
      where: { userId, status: 'PENDING' },
      select: { id: true },
    });
  }

  create(userId: string, applicantNote: string) {
    return this.prisma.trainerApplication.create({
      data: { userId, applicantNote },
      select: trainerApplicationOwnSelect,
    });
  }

  async updatePending(userId: string, id: string, applicantNote: string) {
    const updated = await this.prisma.trainerApplication.updateMany({
      where: { id, userId, status: 'PENDING' },
      data: { applicantNote },
    });
    if (updated.count !== 1) return null;

    return this.prisma.trainerApplication.findFirst({
      where: { id, userId },
      select: trainerApplicationOwnSelect,
    });
  }
}
