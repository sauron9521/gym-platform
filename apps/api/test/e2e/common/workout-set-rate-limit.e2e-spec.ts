import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { WorkoutsController } from '../../../src/modules/workouts/controllers/workouts.controller.js';
import { WorkoutsService } from '../../../src/modules/workouts/services/workouts.service.js';

describe('workout set updates (HTTP rate limit)', () => {
  let app: INestApplication;
  const updateSet = vi.fn().mockResolvedValue({ status: 'COMPLETED' });
  const update = vi.fn().mockResolvedValue({ title: 'Updated workout' });

  beforeAll(async () => {
    // Exercise the actual decorated WorkoutsController and Nest throttler
    // without touching Prisma, authentication sessions, or production storage.
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 10 }] })],
      controllers: [WorkoutsController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: WorkoutsService, useValue: { updateSet, update } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('accepts 120 workout set updates per minute and rejects request 121', async () => {
    const workoutId = randomUUID();
    const setId = randomUUID();
    const endpoint = `/workouts/${workoutId}/sets/${setId}`;
    const server = app.getHttpServer();

    for (let i = 0; i < 120; i++) {
      await request(server)
        .patch(endpoint)
        .send({ status: 'COMPLETED', actualReps: 8 })
        .expect(200);
    }

    await request(server)
      .patch(endpoint)
      .send({ status: 'COMPLETED', actualReps: 8 })
      .expect(429);

    expect(updateSet).toHaveBeenCalledTimes(120);
  }, 20_000);

  it('keeps the global 10-per-minute limit for other workout mutations', async () => {
    const server = app.getHttpServer();
    const endpoint = `/workouts/${randomUUID()}`;

    for (let i = 0; i < 10; i++) {
      await request(server).patch(endpoint).send({ title: 'Updated workout' }).expect(200);
    }

    await request(server).patch(endpoint).send({ title: 'Updated workout' }).expect(429);
    expect(update).toHaveBeenCalledTimes(10);
  }, 10_000);
});
