import { describe, beforeEach, expect, it, vi } from 'vitest';

import { ExerciseTaxonomyController } from '../controllers/exercise-taxonomy.controller.js';
import { ExerciseTaxonomyService } from '../services/exercise-taxonomy.service.js';
import { ExerciseTaxonomyRepository } from '../repositories/exercise-taxonomy.repository.js';
import { equipmentLookupSelect, muscleGroupLookupSelect } from '../selects/exercise.select.js';
import type { PrismaService } from '#src/infra/database/index';

describe('Exercise taxonomy', () => {
  const prisma = {
    muscleGroup: { findMany: vi.fn() },
    equipment: { findMany: vi.fn() },
  };

  beforeEach(() => vi.resetAllMocks());

  it('reads only public reference fields and sorts by name and slug', async () => {
    const expected = [{ id: 'id-1', name: 'Chest', slug: 'chest' }];
    prisma.muscleGroup.findMany.mockResolvedValue(expected);
    prisma.equipment.findMany.mockResolvedValue(expected);

    const repository = new ExerciseTaxonomyRepository(prisma as unknown as PrismaService);
    const service = new ExerciseTaxonomyService(repository);
    const controller = new ExerciseTaxonomyController(service);

    expect(await controller.findMuscleGroups()).toEqual(expected);
    expect(await controller.findEquipment()).toEqual(expected);
    expect(prisma.muscleGroup.findMany).toHaveBeenCalledWith({
      select: muscleGroupLookupSelect,
      orderBy: [{ name: 'asc' }, { slug: 'asc' }],
    });
    expect(prisma.equipment.findMany).toHaveBeenCalledWith({
      select: equipmentLookupSelect,
      orderBy: [{ name: 'asc' }, { slug: 'asc' }],
    });
    expect(muscleGroupLookupSelect).toEqual({ id: true, name: true, slug: true });
    expect(equipmentLookupSelect).toEqual({ id: true, name: true, slug: true });
  });
});
