import { describe, expect, it } from 'vitest';

import { nextAssignmentPage, uniqueAssignments } from '../src/features/programs/lib/assignment-pagination.ts';

describe('assigned program pagination', () => {
  it('never exceeds the server-reported number of pages', () => {
    expect(nextAssignmentPage(1, 3)).toBe(2);
    expect(nextAssignmentPage(2, 3)).toBe(3);
    expect(nextAssignmentPage(3, 3)).toBeUndefined();
    expect(nextAssignmentPage(0, 3)).toBeUndefined();
    expect(nextAssignmentPage(1, 0)).toBeUndefined();
    expect(nextAssignmentPage(1, -1)).toBeUndefined();
    expect(nextAssignmentPage(1.5, 3)).toBeUndefined();
    expect(nextAssignmentPage(1, Number.NaN)).toBeUndefined();
    const lastPage = Number.MAX_SAFE_INTEGER;
    expect(nextAssignmentPage(lastPage, lastPage)).toBeUndefined();
  });

  it('removes duplicate boundary records without dropping later unique assignments', () => {
    const pages = [
      { data: [{ id: 'one', title: 'A' }, { id: 'two', title: 'B' }] },
      { data: [{ id: 'two', title: 'Duplicate' }, { id: 'three', title: 'C' }] },
      { data: [{ id: 'one', title: 'Duplicate' }, { id: 'four', title: 'D' }] },
    ];
    expect(uniqueAssignments(pages)).toEqual([
      { id: 'one', title: 'A' },
      { id: 'two', title: 'B' },
      { id: 'three', title: 'C' },
      { id: 'four', title: 'D' },
    ]);
    expect(uniqueAssignments([])).toEqual([]);
  });
});
