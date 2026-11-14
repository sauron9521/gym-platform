import { Injectable } from '@nestjs/common';

import { ExerciseTaxonomyRepository } from '../repositories/exercise-taxonomy.repository.js';

@Injectable()
export class ExerciseTaxonomyService {
  constructor(private readonly repository: ExerciseTaxonomyRepository) {}

  findMuscleGroups() {
    return this.repository.findMuscleGroups();
  }

  findEquipment() {
    return this.repository.findEquipment();
  }
}
