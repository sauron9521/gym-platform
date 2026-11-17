import { test, expect } from 'vitest';
import { nextAssignmentPage } from '../src/features/programs/lib/assignment-pagination.ts';
test('only advances within the server-reported assignment page count', () => {
  expect(nextAssignmentPage(1, 3)).toBe(2);
  expect(nextAssignmentPage(3, 3)).toBeUndefined();
  expect(nextAssignmentPage(0, 3)).toBeUndefined();
  expect(nextAssignmentPage(1, 0)).toBeUndefined();
});
