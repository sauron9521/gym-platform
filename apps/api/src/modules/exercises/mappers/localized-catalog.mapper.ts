export type CatalogLocale = 'uk' | 'en';

type Translation = {
  locale: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
};

type GlobalExercise = {
  source: 'GLOBAL' | 'ATHLETE_CUSTOM' | 'TRAINER_CUSTOM';
  name: string;
  description: string | null;
  instructions: string | null;
  translations: readonly Translation[];
};

/** Localize curated global records only; never alter user-authored exercise text. */
export function localizedExercise<T extends GlobalExercise>(exercise: T, locale: CatalogLocale) {
  const { translations, ...base } = exercise;
  if (exercise.source !== 'GLOBAL') return base;
  const row = translations.find((value) => value.locale === locale);
  if (!row) return base;
  return {
    ...base,
    name: row.name || base.name,
    description: row.description ?? base.description,
    instructions: row.instructions ?? base.instructions,
  };
}

type TaxonomyEntry = { name: string; translations: readonly { locale: string; name: string }[] };

export function localizedTaxonomy<T extends TaxonomyEntry>(entry: T, locale: CatalogLocale) {
  const { translations, ...base } = entry;
  const row = translations.find((value) => value.locale === locale);
  return { ...base, name: row?.name || base.name };
}
