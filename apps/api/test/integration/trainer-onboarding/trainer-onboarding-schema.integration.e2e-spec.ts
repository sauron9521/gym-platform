import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaModule, PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Trainer onboarding schema (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let applicantId: string;
  let reviewerId: string;

  beforeAll(async () => {
    useTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const [applicant, reviewer] = await Promise.all([
      prisma.user.create({
        data: { email: `trainer-applicant-${randomUUID()}@example.com`, passwordHash: 'hash' },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `trainer-reviewer-${randomUUID()}@example.com`,
          passwordHash: 'hash',
          role: 'ADMIN',
        },
        select: { id: true },
      }),
    ]);

    applicantId = applicant.id;
    reviewerId = reviewer.id;
  }, 20_000);

  afterAll(async () => {
    try {
      if (prisma && applicantId && reviewerId) {
        await prisma.trainerApplication.deleteMany({ where: { userId: applicantId } });
        await prisma.trainerProfile.deleteMany({ where: { userId: applicantId } });
        await prisma.user.deleteMany({ where: { id: { in: [applicantId, reviewerId] } } });
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('creates a pending application with no capability or reviewer', async () => {
    const application = await prisma.trainerApplication.create({
      data: { userId: applicantId, applicantNote: 'Strength training' },
    });
    expect(application.status).toBe('PENDING');
    expect(application.reviewedAt).toBeNull();
    expect(application.reviewerId).toBeNull();

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: applicantId },
      select: { role: true, trainerProfile: true },
    });
    expect(user.role).toBe('ATHLETE');
    expect(user.trainerProfile).toBeNull();
  });

  it('prevents a second pending application, but retains rejected history', async () => {
    const duplicatePending = prisma.trainerApplication.create({
      data: { userId: applicantId },
    });
    await expect(duplicatePending).rejects.toThrow();

    const pending = await prisma.trainerApplication.findFirstOrThrow({
      where: { userId: applicantId, status: 'PENDING' },
    });
    const reviewedAt = new Date();
    await prisma.trainerApplication.update({
      where: { id: pending.id },
      data: {
        status: 'REJECTED',
        reviewerId,
        reviewedAt,
        reviewReason: 'Missing credentials',
      },
    });

    const second = await prisma.trainerApplication.create({
      data: { userId: applicantId },
    });
    expect(second.status).toBe('PENDING');
    expect(second.id).not.toBe(pending.id);
    const history = await prisma.trainerApplication.findMany({
      where: { userId: applicantId },
      orderBy: { createdAt: 'asc' },
    });
    expect(history).toHaveLength(2);
  });

  it('requires a real review actor and timestamp for decision states', async () => {
    const pending = await prisma.trainerApplication.findFirstOrThrow({
      where: { userId: applicantId, status: 'PENDING' },
    });
    const unreviewedApproval = prisma.trainerApplication.update({
      where: { id: pending.id },
      data: { status: 'APPROVED' },
    });
    await expect(unreviewedApproval).rejects.toThrow();

    const approved = await prisma.trainerApplication.update({
      where: { id: pending.id },
      data: { status: 'APPROVED', reviewerId, reviewedAt: new Date() },
    });
    expect(approved.status).toBe('APPROVED');
    const unreviewedRevocation = prisma.trainerApplication.update({
      where: { id: approved.id },
      data: { status: 'REVOKED' },
    });
    await expect(unreviewedRevocation).rejects.toThrow();
    const revoked = await prisma.trainerApplication.update({
      where: { id: approved.id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedById: reviewerId },
    });
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(revoked.revokedById).toBe(reviewerId);
  });

  it('keeps profile fail-closed until an audited explicit activation', async () => {
    const profile = await prisma.trainerProfile.create({ data: { userId: applicantId } });
    expect(profile.isActive).toBe(false);
    const unapprovedActivation = prisma.trainerProfile.update({
      where: { id: profile.id },
      data: { isActive: true },
    });
    await expect(unapprovedActivation).rejects.toThrow();

    const active = await prisma.trainerProfile.update({
      where: { id: profile.id },
      data: { isActive: true, approvedAt: new Date(), approvedById: reviewerId },
    });
    expect(active.isActive).toBe(true);
    const duplicateProfile = prisma.trainerProfile.create({
      data: { userId: applicantId },
    });
    await expect(duplicateProfile).rejects.toThrow();

    const revoked = await prisma.trainerProfile.update({
      where: { id: profile.id },
      data: { isActive: false, revokedAt: new Date(), revokedById: reviewerId },
    });
    expect(revoked.isActive).toBe(false);
    expect(revoked.revokedById).toBe(reviewerId);
  });
});
