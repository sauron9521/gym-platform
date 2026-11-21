import en from './messages/en.json';

/** Compile-time dotted leaf IDs from the shared English catalog. */
type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends object
      ? `${K}.${DotPaths<T[K]>}`
      : never;
}[keyof T & string];

export type TranslationKey = DotPaths<typeof en>;
