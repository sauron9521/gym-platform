import { Injectable } from '@nestjs/common';
import { PrismaService } from '#src/infra/database/index';

import { equipmentLookupSelect, muscleGroupLookupSelect } from '../selects/exercise.select.js';

@Injectable()
export class ExerciseTaxonomyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMuscleGroups() {
    return this.prisma.muscleGroup.findMany({
      select: muscleGroupLookupSelect,
      orderBy: [{ name: 'asc' }, { slug: 'asc' }],
    });
  }

  findEquipment() {
    return this.prisma.equipment.findMany({
      select: equipmentLookupSelect,
      orderBy: [{ name: 'asc' }, { slug: 'asc' }],
    });
  }
}
