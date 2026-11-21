import { describe, expect, it } from 'vitest';
import { localizedExercise, localizedTaxonomy } from '../mappers/localized-catalog.mapper.js';

const exercise = {
  id: 'exercise-1',
  source: 'GLOBAL' as const,
  name: 'Жим лежачи',
  description: 'Вправа на груди',
  instructions: 'Контролюйте рух',
  translations: [
    { locale: 'en', name: 'Bench press', description: 'Chest exercise', instructions: null },
  ],
};

describe('localized exercise read mapping', () => {
  it('translates global text with per-field canonical fallback', () => {
    expect(localizedExercise(exercise, 'en')).toEqual({
      id: 'exercise-1',
      source: 'GLOBAL',
      name: 'Bench press',
      description: 'Chest exercise',
      instructions: 'Контролюйте рух',
    });
  });

  it('keeps canonical fields when no matching translation exists', () => {
    expect(localizedExercise(exercise, 'uk')).toEqual({
      id: 'exercise-1',
      source: 'GLOBAL',
      name: 'Жим лежачи',
      description: 'Вправа на груди',
      instructions: 'Контролюйте рух',
    });
  });

  it('falls back separately for blank names and null descriptions/instructions', () => {
    const result = localizedExercise(
      {
        ...exercise,
        translations: [{ locale: 'en', name: '', description: null, instructions: null }],
      },
      'en',
    );
    expect(result).toEqual({
      id: 'exercise-1',
      source: 'GLOBAL',
      name: 'Жим лежачи',
      description: 'Вправа на груди',
      instructions: 'Контролюйте рух',
    });
  });

  it.each(['ATHLETE_CUSTOM', 'TRAINER_CUSTOM'] as const)(
    'never translates or exposes translations for %s exercises',
    (source) => {
      const result = localizedExercise({ ...exercise, source }, 'en');
      expect(result.name).toBe('Жим лежачи');
      expect(result.description).toBe('Вправа на груди');
      expect(result).not.toHaveProperty('translations');
    },
  );

  it('does not mutate the original exercise or its translation rows', () => {
    const original = structuredClone(exercise);
    const result = localizedExercise(exercise, 'en');
    expect(exercise).toEqual(original);
    expect(result).not.toBe(exercise);
    expect(result).not.toHaveProperty('translations');
  });
});

describe('localized taxonomy mapping', () => {
  const taxonomy = {
    id: 'muscle-1',
    name: 'Грудні',
    translations: [{ locale: 'en', name: 'Chest' }],
  };

  it('translates only the matching locale and strips the translation relation', () => {
    expect(localizedTaxonomy(taxonomy, 'en')).toEqual({ id: 'muscle-1', name: 'Chest' });
    expect(localizedTaxonomy(taxonomy, 'uk')).toEqual({ id: 'muscle-1', name: 'Грудні' });
  });

  it('falls back for an empty translated label without changing the original entry', () => {
    const copy = structuredClone(taxonomy);
    expect(
      localizedTaxonomy({ ...taxonomy, translations: [{ locale: 'en', name: '' }] }, 'en'),
    ).toEqual({
      id: 'muscle-1',
      name: 'Грудні',
    });
    expect(taxonomy).toEqual(copy);
  });
});
