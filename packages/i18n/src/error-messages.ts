import { getMessages, type Locale } from './index';

const errorKeys = {
  BAD_REQUEST: 'badRequest',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'notFound',
  CONFLICT: 'conflict',
  UNIQUE_CONSTRAINT_CONFLICT: 'conflict',
  FOREIGN_KEY_CONFLICT: 'conflict',
  RESOURCE_NOT_FOUND: 'notFound',
  TOO_MANY_REQUESTS: 'rateLimited',
  SERVICE_UNAVAILABLE: 'unavailable',
  INTERNAL_SERVER_ERROR: 'unknown',
} as const;

/** Translate by machine code, never parse the raw server message. */
export function apiErrorMessage(locale: Locale, rawCode: unknown): string {
  const code = typeof rawCode === 'string' ? rawCode : '';
  const key = Object.hasOwn(errorKeys, code)
    ? errorKeys[code as keyof typeof errorKeys]
    : 'unknown';
  return getMessages(locale).errors[key];
}

const issueKeys = {
  invalid_type: 'invalidType',
  invalid_format: 'invalidFormat',
  too_small: 'tooSmall',
  too_big: 'tooBig',
} as const;

export function validationIssueMessage(locale: Locale, rawIssueCode: unknown): string {
  const code = typeof rawIssueCode === 'string' ? rawIssueCode : '';
  const key = Object.hasOwn(issueKeys, code)
    ? issueKeys[code as keyof typeof issueKeys]
    : 'badRequest';
  return getMessages(locale).errors[key];
}
