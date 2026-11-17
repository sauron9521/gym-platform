import en from './messages/en.json';

/** Dotted leaf IDs; misspelled translation IDs fail the TypeScript check. */
type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPaths<T[K]>}`;
}[keyof T & string];

export type TranslationKey = DotPaths<typeof en>;
