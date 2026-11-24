import {
  PublicationConflict,
  PublishProgramUseCase,
} from '../application/publish-program.use-case.js';
import type {
  PublicationDraft,
  PublishProgramCommand,
  PublishProgramPort,
} from '../application/ports/publish-program.port.js';
import { ProgramPublicationError } from '../domain/publication.policy.js';

describe('PublishProgramUseCase', () => {
  const command: PublishProgramCommand = {
    programId: 'program-1',
    versionId: 'version-1',
    actor: { id: 'trainer-1', role: 'TRAINER' },
  };
  const snapshot = { id: 'version-1', publishedAt: new Date(), weight: '42.75' };
  const draft: PublicationDraft = {
    status: 'DRAFT',
    durationWeeks: 4,
    workouts: [{ weekNumber: 1, exercises: [{ sets: [{}] }] }],
  };

  const port = {
    loadOwnedProgramStatus: vi.fn<PublishProgramPort<typeof snapshot>['loadOwnedProgramStatus']>(),
    loadOwnedVersion: vi.fn<PublishProgramPort<typeof snapshot>['loadOwnedVersion']>(),
    publishAtomically: vi.fn<PublishProgramPort<typeof snapshot>['publishAtomically']>(),
  } satisfies PublishProgramPort<typeof snapshot>;

  const useCase = new PublishProgramUseCase(port);

  beforeEach(() => {
    vi.resetAllMocks();
    port.loadOwnedProgramStatus.mockResolvedValue('DRAFT');
    port.loadOwnedVersion.mockResolvedValue(draft);
    port.publishAtomically.mockResolvedValue(snapshot);
  });

  it('checks access and draft state before one write and returns the unchanged snapshot', async () => {
    await expect(useCase.execute(command)).resolves.toBe(snapshot);
    expect(port.loadOwnedProgramStatus).toHaveBeenCalledExactlyOnceWith(command);
    expect(port.loadOwnedVersion).toHaveBeenCalledExactlyOnceWith(command);
    expect(port.publishAtomically).toHaveBeenCalledExactlyOnceWith(command);
    expect(port.loadOwnedProgramStatus.mock.invocationCallOrder[0]).toBeLessThan(
      port.loadOwnedVersion.mock.invocationCallOrder[0]!,
    );
    expect(port.loadOwnedVersion.mock.invocationCallOrder[0]).toBeLessThan(
      port.publishAtomically.mock.invocationCallOrder[0]!,
    );
  });

  it('stops before reading versions when access is denied', async () => {
    const denied = new Error('Access denied');
    port.loadOwnedProgramStatus.mockRejectedValue(denied);
    await expect(useCase.execute(command)).rejects.toBe(denied);
    expect(port.loadOwnedVersion).not.toHaveBeenCalled();
    expect(port.publishAtomically).not.toHaveBeenCalled();
  });

  it('stops when access is revoked during the second scoped read', async () => {
    const denied = new Error('Access revoked');
    port.loadOwnedVersion.mockRejectedValue(denied);
    await expect(useCase.execute(command)).rejects.toBe(denied);
    expect(port.publishAtomically).not.toHaveBeenCalled();
  });

  it('rejects archived programs before reading versions', async () => {
    port.loadOwnedProgramStatus.mockResolvedValue('ARCHIVED');
    await expect(useCase.execute(command)).rejects.toEqual(
      new PublicationConflict('ARCHIVED_PROGRAM'),
    );
    expect(port.loadOwnedVersion).not.toHaveBeenCalled();
    expect(port.publishAtomically).not.toHaveBeenCalled();
  });

  it('rejects immutable versions before writing', async () => {
    port.loadOwnedVersion.mockResolvedValue({ ...draft, status: 'PUBLISHED' });
    await expect(useCase.execute(command)).rejects.toEqual(
      new PublicationConflict('NON_DRAFT_VERSION'),
    );
    expect(port.publishAtomically).not.toHaveBeenCalled();
  });

  it('rejects invalid content before writing', async () => {
    port.loadOwnedVersion.mockResolvedValue({ ...draft, workouts: [] });
    await expect(useCase.execute(command)).rejects.toEqual(
      new ProgramPublicationError('EMPTY_PROGRAM'),
    );
    expect(port.publishAtomically).not.toHaveBeenCalled();
  });

  it('maps a stale atomic write to a stable conflict without retrying', async () => {
    port.publishAtomically.mockResolvedValue(null);
    await expect(useCase.execute(command)).rejects.toEqual(new PublicationConflict('STALE_VERSION'));
    expect(port.publishAtomically).toHaveBeenCalledOnce();
  });

  it('preserves locked validation errors and does not mask unexpected failures', async () => {
    const invalid = new ProgramPublicationError('UNAVAILABLE_EXERCISES');
    port.publishAtomically.mockRejectedValueOnce(invalid);
    await expect(useCase.execute(command)).rejects.toBe(invalid);

    const unexpected = new Error('Database disconnected');
    port.publishAtomically.mockRejectedValueOnce(unexpected);
    await expect(useCase.execute(command)).rejects.toBe(unexpected);
    expect(port.publishAtomically).toHaveBeenCalledTimes(2);
  });
});
