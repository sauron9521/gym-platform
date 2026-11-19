import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { Prisma } from '#prisma/client';

import type { TrainerApplicationInput } from '../dto/trainer-application.schemas.js';
import { TrainerApplicationsRepository } from '../repositories/trainer-applications.repository.js';

@Injectable()
export class TrainerApplicationsService {
  constructor(private readonly applications: TrainerApplicationsRepository) {}

  async findMine(userId: string) {
    const user = await this.applications.findApplicant(userId);
    if (!user) throw new UnauthorizedException('Account session is no longer valid');

    return this.applications.findLatest(userId);
  }

  async submit(userId: string, input: TrainerApplicationInput) {
    await this.assertEligible(userId);

    // An approved application cannot be resubmitted; rejected and revoked
    // decisions are immutable history and permit a new request.
    if (await this.applications.findBlocking(userId)) {
      throw new ConflictException('Trainer application is already pending or approved');
    }

    try {
      // The PostgreSQL partial unique index is the final concurrency guard.
      return await this.applications.create(userId, input.applicantNote);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Trainer application is already pending');
      }
      throw error;
    }
  }

  async updateMine(userId: string, input: TrainerApplicationInput) {
    await this.assertEligible(userId);

    const pending = await this.applications.findPendingId(userId);
    if (!pending) {
      throw new ConflictException('Only pending trainer applications can be edited');
    }

    // CAS on (id, owner, status) cannot overwrite a concurrent admin decision.
    const updated = await this.applications.updatePending(userId, pending.id, input.applicantNote);
    if (!updated) throw new ConflictException('Trainer application is no longer pending');

    return updated;
  }

  private async assertEligible(userId: string): Promise<void> {
    const user = await this.applications.findApplicant(userId);
    if (!user) throw new UnauthorizedException('Account session is no longer valid');

    // Explicitly deny legacy TRAINER / ADMIN role self-application. The
    // new capability policy will be introduced separately in #291/#311.
    if (user.role !== 'ATHLETE' || user.trainerProfile?.isActive) {
      throw new ForbiddenException('This account cannot submit a trainer application');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('Verify your email before applying as a trainer');
    }
  }
}
