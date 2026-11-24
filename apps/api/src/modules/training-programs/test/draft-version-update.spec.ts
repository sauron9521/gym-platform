import { normalizeDraftVersionChanges } from '../application/draft-version-update.js';

describe('normalizeDraftVersionChanges', () => {
  it('normalizes only the supplied fields', () => {
    const input = { title: '  Strength  ', description: '  Progress  ' };
    expect(normalizeDraftVersionChanges(input)).toEqual({
      title: 'Strength',
      description: 'Progress',
    });
    expect(input.title).toBe('  Strength  ');
  });

  it('preserves omitted values and explicit nulls', () => {
    expect(normalizeDraftVersionChanges({})).toEqual({});
    expect(normalizeDraftVersionChanges({ durationWeeks: null, description: null })).toEqual({
      durationWeeks: null,
      description: null,
    });
  });

  it('clears a blank description and retains numeric duration', () => {
    expect(normalizeDraftVersionChanges({ description: '   ', durationWeeks: 4 })).toEqual({
      description: null,
      durationWeeks: 4,
    });
  });
});
