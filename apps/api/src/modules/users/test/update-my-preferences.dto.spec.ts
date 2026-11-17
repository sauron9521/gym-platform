import { describe, expect, it } from 'vitest';

import { updateMyPreferencesSchema } from '../dto/update-my-preferences.dto.js';

describe('updateMyPreferencesSchema', () => {
  it('accepts supported languages and clearing a preference', () => {
    for (const preferredLocale of ['uk', 'en', null]) {
      expect(updateMyPreferencesSchema.safeParse({ preferredLocale }).success).toBe(true);
    }
  });

  it('rejects unsupported languages, empty payloads and account privilege escalation', () => {
    for (const body of [
      {},
      { preferredLocale: 'fr' },
      { preferredLocale: 'en-US' },
      { preferredLocale: 'en', role: 'ADMIN' },
      { preferredLocale: undefined },
    ]) {
      expect(updateMyPreferencesSchema.safeParse(body).success).toBe(false);
    }
  });
});
