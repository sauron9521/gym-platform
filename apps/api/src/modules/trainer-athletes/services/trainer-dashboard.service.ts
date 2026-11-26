import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { UsersService } from '#src/modules/users/public-api';
import { TrainerDashboardRepository } from '../repositories/trainer-dashboard.repository.js';

import type { TrainerAthleteActor } from '../types/trainer-athlete.types.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Owner-only overview; role embedded in a session is never authoritative. */
@Injectable()
export class TrainerDashboardService {
  constructor(
    private readonly users: UsersService,
    private readonly dashboard: TrainerDashboardRepository,
  ) {}

  async overview(actor: TrainerAthleteActor, now: Date = new Date()) {
    const grants = await this.users.findMyCapabilities(actor.id);
    if (!grants.trainer || grants.admin) {
      throw new ForbiddenException('Current trainer approval is required');
    }

    const from = new Date(now.getTime() - THIRTY_DAYS_MS);
    const counts = await this.dashboard.countOverview(actor.id, from, now);

    return {
      asOf: now,
      windowStart: from,
      ...counts,
    };
  }

  /** Athlete-level progress belongs only to a live, owner-scoped collaboration. */
  async clientProgress(actor: TrainerAthleteActor, relationId: string, now: Date = new Date()) {
    const grants = await this.users.findMyCapabilities(actor.id);
    if (!grants.trainer || grants.admin) {
      throw new ForbiddenException('Current trainer approval is required');
    }

    const from = new Date(now.getTime() - THIRTY_DAYS_MS);
    const counts = await this.dashboard.countClientProgress(actor.id, relationId, from, now);
    // Identical not-found for missing, foreign, ended or otherwise ineligible clients.
    if (!counts) throw new NotFoundException('Active trainer client not found');

    return { asOf: now, windowStart: from, ...counts };
  }
}
