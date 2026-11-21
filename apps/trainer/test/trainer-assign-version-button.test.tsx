// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TrainerAssignVersionButton } from '../src/features/training-programs/ui/trainer-assign-version-button';
import { assignTrainerVersion } from '../src/features/training-programs/lib/assign-trainer-version';

vi.mock('next-intl', () => ({ useLocale: () => 'en' }));
vi.mock('../src/features/training-programs/lib/assign-trainer-version', () => ({
  assignTrainerVersion: vi.fn(),
}));

const relationId = '123e4567-e89b-42d3-a456-426614174000';
const programId = '123e4567-e89b-42d3-a456-426614174001';
const versionId = '123e4567-e89b-42d3-a456-426614174002';
const assignmentId = '123e4567-e89b-42d3-a456-426614174003';
const clientPath = `/workspace/clients/${relationId}`;

function mount() {
  return render(
    <TrainerAssignVersionButton
      relationId={relationId}
      programId={programId}
      versionId={versionId}
      versionTitle="Published strength plan"
      versionNumber={2}
      clientPath={clientPath}
    />,
  );
}

describe('Trainer assignment button lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it('is explicit about no assignment until a trainer submits', () => {
    mount();
    expect(screen.getByRole('status').textContent).toContain('No assignment has been created');
    expect(screen.getByText(/Published strength plan/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Assign version to client' })).toBeTruthy();
    expect(assignTrainerVersion).not.toHaveBeenCalled();
  });

  it('locks synchronously against two clicks before React rerenders, including while in flight', async () => {
    let resolve: (value: { kind: 'created'; assignmentId: string }) => void = () => undefined;
    vi.mocked(assignTrainerVersion).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    mount();
    const button = screen.getByRole('button', { name: 'Assign version to client' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(assignTrainerVersion).toHaveBeenCalledTimes(1);
    expect(assignTrainerVersion).toHaveBeenCalledWith(relationId, programId, versionId);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Assigning program');

    await act(async () => {
      resolve({ kind: 'created', assignmentId });
    });
    expect(screen.getByRole('status').textContent).toContain('Program assigned');
    expect(
      screen.getByRole('link', { name: 'Review client assignments' }).getAttribute('href'),
    ).toBe(clientPath);
    fireEvent.click(button);
    expect(assignTrainerVersion).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    ['conflict', 'Conflict'],
    ['unauthenticated', 'session expired'],
    ['forbidden', 'permission'],
    ['not_found', 'no longer available'],
    ['invalid', 'Request rejected'],
    ['rate_limited', 'Too many requests'],
    ['uncertain', 'may have succeeded'],
  ] as const)(
    'blocks all followup POSTs after %s and provides manual read-only review',
    async (kind, fragment) => {
      vi.mocked(assignTrainerVersion).mockResolvedValueOnce({ kind });
      mount();
      const button = screen.getByRole('button', { name: 'Assign version to client' });
      fireEvent.click(button);
      await waitFor(() => expect(screen.getByRole('status').textContent).toContain(fragment));
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText(/No automatic retry/)).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Review client assignments' })).toBeTruthy();
      fireEvent.click(button);
      expect(assignTrainerVersion).toHaveBeenCalledTimes(1);
    },
  );

  it('treats a thrown helper as ambiguous and never blindly retries', async () => {
    vi.mocked(assignTrainerVersion).mockRejectedValueOnce(new Error('network lost'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Assign version to client' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('may have succeeded'),
    );
    expect(assignTrainerVersion).toHaveBeenCalledTimes(1);
  });
});
