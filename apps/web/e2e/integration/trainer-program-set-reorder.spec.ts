import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { login, origin, promoteTestTrainer, register } from '../support/real-api-accounts';

test('real API: trainer moves sets in both directions, persists order, and outsiders cannot reorder', async ({
  page: ownerPage,
  browser,
}) => {
  test.setTimeout(120_000);
  const otherContext = await browser.newContext();
  try {
    const otherPage = await otherContext.newPage();
    const owner = await register(ownerPage, 'browser-program-set-reorder-owner');
    const outsider = await register(otherPage, 'browser-program-set-reorder-other');
    await promoteTestTrainer(owner.id);
    await promoteTestTrainer(outsider.id);
    await login(ownerPage, owner.email, 'TRAINER');
    await login(otherPage, outsider.email, 'TRAINER');

    const catalog = await ownerPage.request.get('/backend/exercises?search=bench&limit=20');
    expect(catalog.status()).toBe(200);
    const available: { data: Array<{ id: string; name: string; slug: string | null }> } =
      await catalog.json();
    const exercise = available.data.find((entry) => entry.slug === 'barbell-bench-press');
    expect(exercise).toBeDefined();

    const created = await ownerPage.request.post('/backend/training-programs', {
      headers: { origin },
      data: { title: 'Порядок підходів ' + randomUUID(), durationWeeks: 2 },
    });
    expect(created.status()).toBe(201);
    const program: { id: string; versions: Array<{ id: string }> } = await created.json();
    const versionId = program.versions[0]!.id;
    const workoutsPath =
      '/backend/training-programs/' + program.id + '/versions/' + versionId + '/workouts';
    const day = await ownerPage.request.post(workoutsPath, {
      headers: { origin },
      data: { weekNumber: 1, dayNumber: 1, title: 'День жиму ' + randomUUID() },
    });
    expect(day.status()).toBe(201);
    const version: { workouts: Array<{ id: string }> } = await day.json();
    const workoutId = version.workouts[0]!.id;
    const withExercise = await ownerPage.request.post(workoutsPath + '/' + workoutId + '/exercises', {
      headers: { origin },
      data: { exerciseId: exercise!.id },
    });
    expect(withExercise.status()).toBe(201);
    const populated: { workouts: Array<{ exercises: Array<{ id: string }> }> } =
      await withExercise.json();
    const programExerciseId = populated.workouts[0]!.exercises[0]!.id;
    const setsPath = workoutsPath + '/' + workoutId + '/exercises/' + programExerciseId + '/sets';
    const setIds: string[] = [];

    for (const plannedReps of [5, 8, 12]) {
      const response = await ownerPage.request.post(setsPath, {
        headers: { origin },
        data: { setType: 'WORKING', plannedReps },
      });
      expect(response.status()).toBe(201);
      const nextVersion: {
        workouts: Array<{ exercises: Array<{ sets: Array<{ id: string }> }> }>;
      } = await response.json();
      const sets = nextVersion.workouts[0]!.exercises[0]!.sets;
      setIds.push(sets[sets.length - 1]!.id);
    }

    const reorderPath = setsPath + '/reorder';
    await ownerPage.goto('/trainer/programs/' + program.id);
    const list = ownerPage.getByRole('list', { name: 'Підходи вправи ' + exercise!.name });
    await expect(list.locator(':scope > li')).toHaveCount(3);
    await expect(list.locator(':scope > li').nth(0)).toContainText('5 повт.');
    await expect(list.locator(':scope > li').nth(1)).toContainText('8 повт.');
    await expect(list.locator(':scope > li').nth(2)).toContainText('12 повт.');
    await expect(
      list.getByRole('button', {
        name: 'Перемістити підхід 1 вгору у вправі ' + exercise!.name,
      }),
    ).toBeDisabled();
    await expect(
      list.getByRole('button', {
        name: 'Перемістити підхід 3 вниз у вправі ' + exercise!.name,
      }),
    ).toBeDisabled();

    const movedUp = ownerPage.waitForResponse(
      (response) => response.url().includes(reorderPath) && response.request().method() === 'PATCH',
    );
    await list
      .getByRole('button', { name: 'Перемістити підхід 2 вгору у вправі ' + exercise!.name })
      .click();
    const patchUp = await movedUp;
    expect(patchUp.status()).toBe(200);
    expect(patchUp.request().postDataJSON()).toEqual({
      setIds: [setIds[1], setIds[0], setIds[2]],
    });
    const afterMove: {
      workouts: Array<{
        exercises: Array<{ sets: Array<{ id: string; setNumber: number; plannedReps: number }> }>;
      }>;
    } = await patchUp.json();
    const reordered = afterMove.workouts[0]!.exercises[0]!.sets;
    expect(reordered.map((set) => set.id)).toEqual([setIds[1], setIds[0], setIds[2]]);
    expect(reordered.map((set) => set.setNumber)).toEqual([1, 2, 3]);
    expect(reordered.map((set) => set.plannedReps)).toEqual([8, 5, 12]);

    await expect(ownerPage.getByText('Порядок підходів оновлено')).toBeVisible();
    await expect(list.locator(':scope > li').nth(0)).toContainText('8 повт.');
    await expect(list.locator(':scope > li').nth(1)).toContainText('5 повт.');

    await ownerPage.reload();
    const persisted = ownerPage.getByRole('list', { name: 'Підходи вправи ' + exercise!.name });
    await expect(persisted.locator(':scope > li').nth(0)).toContainText('8 повт.');
    await expect(persisted.locator(':scope > li').nth(1)).toContainText('5 повт.');
    await expect(persisted.locator(':scope > li').nth(2)).toContainText('12 повт.');

    const movedDown = ownerPage.waitForResponse(
      (response) => response.url().includes(reorderPath) && response.request().method() === 'PATCH',
    );
    await persisted
      .getByRole('button', { name: 'Перемістити підхід 1 вниз у вправі ' + exercise!.name })
      .click();
    const patchDown = await movedDown;
    expect(patchDown.status()).toBe(200);
    expect(patchDown.request().postDataJSON()).toEqual({ setIds });
    await expect(persisted.locator(':scope > li').nth(0)).toContainText('5 повт.');
    await expect(persisted.locator(':scope > li').nth(1)).toContainText('8 повт.');

    // API validates that every set is listed exactly once, even when called directly.
    const incomplete = await ownerPage.request.patch(reorderPath, {
      headers: { origin },
      data: { setIds: [setIds[0], setIds[1]] },
    });
    expect(incomplete.status()).toBe(400);
    const duplicated = await ownerPage.request.patch(reorderPath, {
      headers: { origin },
      data: { setIds: [setIds[0], setIds[0], setIds[2]] },
    });
    expect(duplicated.status()).toBe(400);
    const denied = await otherPage.request.patch(reorderPath, {
      headers: { origin },
      data: { setIds },
    });
    expect(denied.status()).toBe(404);

    await ownerPage.reload();
    await expect(
      ownerPage.getByRole('list', { name: 'Підходи вправи ' + exercise!.name })
        .locator(':scope > li')
        .nth(0),
    ).toContainText('5 повт.');
  } finally {
    await otherContext.close();
  }
});
