import { ForbiddenException, Injectable } from '@nestjs/common';

import { UsersService } from '#src/modules/users/services/users.service';
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
}
