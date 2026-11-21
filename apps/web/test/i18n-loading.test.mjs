import { describe, expect, it } from 'vitest';
import { getFlatMessages } from '@gym/i18n';
import { getMessagesAsync } from '@gym/i18n/async';

describe('Lazy localized catalogs', () => {
  it('loads exactly the requested locale and keeps the key structure', async () => {
    const [uk, en] = await Promise.all([getMessagesAsync('uk'), getMessagesAsync('en')]);
    expect(uk.common.save).toBe('Зберегти');
    expect(en.common.save).toBe('Save');
    expect(Object.keys(uk)).toEqual(Object.keys(en));
  });
  it('reuses frozen FormatJS catalog data without mutating shared messages', () => {
    expect(getFlatMessages('uk')).toBe(getFlatMessages('uk'));
    expect(Object.isFrozen(getFlatMessages('uk'))).toBe(true);
  });
});
