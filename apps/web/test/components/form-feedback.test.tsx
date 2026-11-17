import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { FormFeedback } from '../../src/shared/ui/form-feedback';

afterEach(cleanup);

test('errors render an accessible alert only when a message exists', () => {
  const { rerender } = render(<FormFeedback message={null} />);
  expect(screen.queryByRole('alert')).toBeNull();
  rerender(<FormFeedback message="Не вдалося зберегти дані." id="save-error" />);
  expect(screen.getByRole('alert').textContent).toContain('Не вдалося');
  expect(screen.getByRole('alert').id).toBe('save-error');
});

test('successful operations use status rather than a false error alarm', () => {
  render(<FormFeedback kind="success" message="Збережено." />);
  expect(screen.getByRole('status').textContent).toBe('Збережено.');
  expect(screen.queryByRole('alert')).toBeNull();
});
