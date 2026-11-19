import en from './messages/en.json';
import uk from './messages/uk.json';
import type { Locale } from './locales';

type ErrorMessageKey = keyof typeof en.errors;

const apiCodeKeys = {
  BAD_REQUEST: 'badRequest',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'notFound',
  METHOD_NOT_ALLOWED: 'methodNotAllowed',
  CONFLICT: 'conflict',
  PAYLOAD_TOO_LARGE: 'payloadTooLarge',
  UNSUPPORTED_MEDIA_TYPE: 'unsupportedMediaType',
  UNPROCESSABLE_ENTITY: 'unprocessableEntity',
  TOO_MANY_REQUESTS: 'rateLimited',
  SERVICE_UNAVAILABLE: 'unavailable',
  INTERNAL_SERVER_ERROR: 'unknown',
  UNIQUE_CONSTRAINT_CONFLICT: 'conflict',
  FOREIGN_KEY_CONFLICT: 'conflict',
  RESOURCE_NOT_FOUND: 'notFound',
} as const satisfies Record<string, ErrorMessageKey>;

const issueCodeKeys = {
  invalid_type: 'invalidType',
  invalid_format: 'invalidFormat',
  invalid_value: 'invalidValue',
  too_small: 'tooSmall',
  too_big: 'tooBig',
  unrecognized_keys: 'unrecognizedKeys',
  invalid_union: 'badRequest',
  invalid_key: 'invalidType',
  invalid_element: 'invalidType',
  not_multiple_of: 'badRequest',
  custom: 'badRequest',
} as const satisfies Record<string, ErrorMessageKey>;

function translate(locale: Locale, key: ErrorMessageKey): string {
  // No import from the package entrypoint: keep this helper free of export cycles.
  return (locale === 'en' ? en.errors : uk.errors)[key];
}

/**
 * Translate the stable API envelope `code`, never its untrusted `message` or `error`.
 * Unknown and inherited property names cannot select arbitrary dictionary values.
 */
export function apiErrorMessage(locale: Locale, rawCode: unknown): string {
  const code = typeof rawCode === 'string' ? rawCode : '';
  const key = Object.hasOwn(apiCodeKeys, code)
    ? apiCodeKeys[code as keyof typeof apiCodeKeys]
    : 'unknown';
  return translate(locale, key);
}

/**
 * Translate Zod 4 issue `code` only. Field-specific size/format details are
 * deliberately omitted: consumers may add safe, localized field hints later.
 */
export function validationIssueMessage(locale: Locale, rawIssueCode: unknown): string {
  const code = typeof rawIssueCode === 'string' ? rawIssueCode : '';
  const key = Object.hasOwn(issueCodeKeys, code)
    ? issueCodeKeys[code as keyof typeof issueCodeKeys]
    : 'badRequest';
  return translate(locale, key);
}
