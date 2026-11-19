import { describe, expect, it } from 'vitest';

import { apiErrorMessage, getMessages, validationIssueMessage } from '@gym/i18n';

describe('Localized API error codes', () => {
  const cases = [
    ['BAD_REQUEST', 'badRequest'],
    ['UNAUTHORIZED', 'unauthorized'],
    ['FORBIDDEN', 'forbidden'],
    ['NOT_FOUND', 'notFound'],
    ['METHOD_NOT_ALLOWED', 'methodNotAllowed'],
    ['CONFLICT', 'conflict'],
    ['PAYLOAD_TOO_LARGE', 'payloadTooLarge'],
    ['UNSUPPORTED_MEDIA_TYPE', 'unsupportedMediaType'],
    ['UNPROCESSABLE_ENTITY', 'unprocessableEntity'],
    ['TOO_MANY_REQUESTS', 'rateLimited'],
    ['SERVICE_UNAVAILABLE', 'unavailable'],
    ['INTERNAL_SERVER_ERROR', 'unknown'],
    ['UNIQUE_CONSTRAINT_CONFLICT', 'conflict'],
    ['FOREIGN_KEY_CONFLICT', 'conflict'],
    ['RESOURCE_NOT_FOUND', 'notFound'],
  ];

  it.each(cases)('maps stable NestJS code %s to %s', (code, key) => {
    for (const locale of ['uk', 'en']) {
      expect(apiErrorMessage(locale, code)).toBe(getMessages(locale).errors[key]);
    }
  });

  it('falls back safely for unknown, inherited and malformed API codes', () => {
    for (const code of ['PRIVATE_DB_TOKEN', 'HTTP_418', '__proto__', 'constructor', null, 123, {}]) {
      for (const locale of ['uk', 'en']) {
        expect(apiErrorMessage(locale, code)).toBe(getMessages(locale).errors.unknown);
      }
    }
  });

  it('never reflects raw backend error strings as display copy', () => {
    const rawResponse = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'SECRET_SQL_AND_PERSONAL_DETAILS',
      error: 'Private error',
    };
    const message = apiErrorMessage('en', rawResponse.code);
    expect(message).toBe(getMessages('en').errors.unknown);
    expect(message).not.toContain(rawResponse.message);
    expect(message).not.toContain(rawResponse.error);
  });
});

describe('Localized Zod 4 issue codes', () => {
  const cases = [
    ['invalid_type', 'invalidType'],
    ['invalid_format', 'invalidFormat'],
    ['invalid_value', 'invalidValue'],
    ['too_small', 'tooSmall'],
    ['too_big', 'tooBig'],
    ['unrecognized_keys', 'unrecognizedKeys'],
    ['invalid_union', 'badRequest'],
    ['invalid_key', 'invalidType'],
    ['invalid_element', 'invalidType'],
    ['not_multiple_of', 'badRequest'],
    ['custom', 'badRequest'],
  ];

  it.each(cases)('maps issue code %s to %s', (code, key) => {
    for (const locale of ['uk', 'en']) {
      expect(validationIssueMessage(locale, code)).toBe(getMessages(locale).errors[key]);
    }
  });

  it('does not reflect unknown or forged issue content', () => {
    for (const issue of ['private_validation_error', '__proto__', 'constructor', null, {}]) {
      for (const locale of ['uk', 'en']) {
        expect(validationIssueMessage(locale, issue)).toBe(getMessages(locale).errors.badRequest);
      }
    }
  });
});
