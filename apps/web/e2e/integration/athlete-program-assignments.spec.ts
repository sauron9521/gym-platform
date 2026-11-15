import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { login, register } from '../support/real-api-accounts';
import {
  seedActiveAssignment,
  seedReferenceTrainer,
  seedTrainingProgram,
} from '../support/training-program-fixtures';

test('real API: athlete sees only their own published program assignment', async ({
  page: athletePage,
  browser,
}) => {
  test.setTimeout(120_000);

  const otherContext = await browser.newContext();
  try {
    const otherPage = await otherContext.newPage();
    const athlete = await register(athletePage, 'assigned-program-athlete');
    const outsider = await register(otherPage, 'unassigned-program-athlete');

    // A trainer reference is required by the database, not another logged-in
    // browser. Only two real athlete registrations use the throttled API.
    const trainerId = await seedReferenceTrainer();
    const program = await seedTrainingProgram(
      trainerId,
      'Athlete program ' + randomUUID(),
      'PUBLISHED',
    );
    const assignmentId = await seedActiveAssignment(trainerId, athlete.id, program.versionId);

    await login(athletePage, athlete.email, 'ATHLETE');
    await login(otherPage, outsider.email, 'ATHLETE');

    await athletePage.goto('/athlete/programs');
    await expect(athletePage.getByRole('heading', { name: 'Мої програми' })).toBeVisible();
    await expect(athletePage.getByRole('heading', { name: program.title })).toBeVisible();
    await expect(athletePage.getByText('Усього призначень: 1')).toBeVisible();

    await athletePage.locator('#training-assignment-status').selectOption('COMPLETED');
    await expect(
      athletePage.getByRole('heading', { name: 'Немає призначених програм' }),
    ).toBeVisible();
    await athletePage.locator('#training-assignment-status').selectOption('ACTIVE');
    await expect(athletePage.getByRole('heading', { name: program.title })).toBeVisible();

    await otherPage.goto('/athlete/programs');
    await expect(
      otherPage.getByRole('heading', { name: 'Немає призначених програм' }),
    ).toBeVisible();
    await expect(otherPage.getByRole('heading', { name: program.title })).toHaveCount(0);

    // Both users are authenticated, but only the assigned athlete can read
    // this assignment. Neither can access the trainer-only program endpoint.
    const forbiddenAssignment = await otherPage.request.get(
      '/backend/training-programs/assignments/' + assignmentId,
    );
    expect(forbiddenAssignment.status()).toBe(404);
    const allowedAssignment = await athletePage.request.get(
      '/backend/training-programs/assignments/' + assignmentId,
    );
    expect(allowedAssignment.status()).toBe(200);
    expect(await allowedAssignment.json()).toMatchObject({
      id: assignmentId,
      athleteId: athlete.id,
      versionId: program.versionId,
    });

    await athletePage.goto('/trainer/programs');
    await expect(
      athletePage.getByRole('heading', { name: 'Доступ заборонено' }),
    ).toBeVisible();
    const forbiddenProgram = await athletePage.request.get(
      '/backend/training-programs/' + program.id,
    );
    expect(forbiddenProgram.status()).toBe(403);

    const guestContext = await browser.newContext();
    try {
      const guest = await guestContext.newPage();
      const noSession = await guest.request.get(
        '/backend/training-programs/assignments/' + assignmentId,
      );
      expect(noSession.status()).toBe(401);
    } finally {
      await guestContext.close();
    }
  } finally {
    await otherContext.close();
  }
});
