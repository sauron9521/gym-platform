import { describe, expect, it } from 'vitest';
import { apiErrorMessage, validationIssueMessage } from '@gym/i18n';

describe('Localized error codes', () => {
  it('translates stable API error codes without echoing raw server text', () => {
    expect(apiErrorMessage('en', 'TOO_MANY_REQUESTS')).toMatch(/Too many requests/);
    expect(apiErrorMessage('uk', 'TOO_MANY_REQUESTS')).toMatch(/Забагато/);
    expect(apiErrorMessage('en', 'UNKNOWN_PRIVATE_CODE')).toBe(apiErrorMessage('en', 'INTERNAL_SERVER_ERROR'));
  });
  it('translates safe Zod issue codes', () => {
    expect(validationIssueMessage('en', 'invalid_format')).toBe('Invalid format.');
    expect(validationIssueMessage('uk', 'too_small')).toMatch(/замале/);
  });
});
