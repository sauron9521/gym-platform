import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '#prisma/client';
import { TrainingProgramAssignmentService } from '../services/training-program-assignment.service.js';
import {
  assignmentFullReadWhere,
  assignmentParticipantWhere,
} from '../policies/training-program-assignment-read.policy.js';
import type { TrainingProgramActor } from '../types/training-program.types.js';

describe('TrainingProgramAssignmentService', () => {
  const repository = {
    createAssignmentForActiveRelationship: vi.fn(),
    findManyAssignments: vi.fn(),
    findManyAssignmentsForParticipant: vi.fn(),
    findAssignmentById: vi.fn(),
    findAssignmentDetailsById: vi.fn(),
    findRestrictedAssignmentById: vi.fn(),
    updateAssignment: vi.fn(),
    completeAssignmentIfNoUnfinishedWorkouts: vi.fn(),
    cancelAssignmentIfTrainerEligible: vi.fn(),
  };
  const crud = { findOne: vi.fn() };
  const versions = { findVersion: vi.fn() };
  const access = { assertTrainer: vi.fn(), assertAssignmentParticipant: vi.fn() };
  const trainerAthletes = { findOne: vi.fn() };
  const trainer: TrainingProgramActor = { id: 'trainer-1', role: 'TRAINER' };
  const athlete: TrainingProgramActor = { id: 'athlete-1', role: 'ATHLETE' };
  const admin: TrainingProgramActor = { id: 'admin-1', role: 'ADMIN' };
  const programId = 'program-1';
  const versionId = 'version-1';
  const assignmentId = 'assignment-1';
  const assignmentInput = { trainerAthleteId: 'relationship-1' };
  const relationship = {
    id: 'relationship-1',
    trainerId: trainer.id,
    athleteId: athlete.id,
    status: 'ACTIVE',
  };
  const activeAssignment = {
    id: assignmentId,
    status: 'ACTIVE',
    athleteId: athlete.id,
    assignedById: trainer.id,
    trainerAthleteId: relationship.id,
    trainerAthlete: { trainerId: trainer.id, athleteId: athlete.id, status: 'ACTIVE' },
  };
  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('Concurrent write', {
      code,
      clientVersion: '7.0.0',
    });
  let service: TrainingProgramAssignmentService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new TrainingProgramAssignmentService(
      repository as never,
      crud as never,
      versions as never,
      access as never,
      trainerAthletes as never,
    );
    access.assertTrainer.mockImplementation((actor: TrainingProgramActor) => {
      if (actor.role !== 'TRAINER') throw new ForbiddenException();
    });
    access.assertAssignmentParticipant.mockImplementation(async (actor: TrainingProgramActor) => {
      if (actor.id === admin.id) throw new ForbiddenException();
    });
    crud.findOne.mockResolvedValue({ id: programId, status: 'DRAFT' });
    versions.findVersion.mockResolvedValue({ id: versionId, status: 'PUBLISHED' });
    trainerAthletes.findOne.mockResolvedValue(relationship);
    repository.findAssignmentById.mockResolvedValue(activeAssignment);
    repository.cancelAssignmentIfTrainerEligible.mockResolvedValue({
      ...activeAssignment,
      status: 'CANCELLED',
    });
  });

  it('creates an assignment only from a published owned program and active relationship', async () => {
    const assignment = { id: assignmentId };
    repository.createAssignmentForActiveRelationship.mockResolvedValue(assignment);
    await expect(
      service.assignVersionToAthlete(trainer, programId, versionId, assignmentInput),
    ).resolves.toBe(assignment);
    expect(access.assertTrainer).toHaveBeenCalledExactlyOnceWith(trainer);
    expect(crud.findOne).toHaveBeenCalledExactlyOnceWith(programId, trainer);
    expect(versions.findVersion).toHaveBeenCalledExactlyOnceWith(programId, versionId, trainer);
    expect(trainerAthletes.findOne).toHaveBeenCalledExactlyOnceWith(
      assignmentInput.trainerAthleteId,
      trainer,
    );
    expect(repository.createAssignmentForActiveRelationship).toHaveBeenCalledExactlyOnceWith({
      programId,
      versionId,
      trainerAthleteId: relationship.id,
      trainerId: trainer.id,
      athleteId: athlete.id,
    });
  });

  it('rejects a non-trainer before looking up resources', async () => {
    await expect(
      service.assignVersionToAthlete(athlete, programId, versionId, assignmentInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(crud.findOne).not.toHaveBeenCalled();
    expect(repository.createAssignmentForActiveRelationship).not.toHaveBeenCalled();
  });

  it('rejects archived programs before requesting version details', async () => {
    crud.findOne.mockResolvedValue({ id: programId, status: 'ARCHIVED' });
    await expect(
      service.assignVersionToAthlete(trainer, programId, versionId, assignmentInput),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(versions.findVersion).not.toHaveBeenCalled();
  });

  it('rejects draft versions before looking up a relationship', async () => {
    versions.findVersion.mockResolvedValue({ id: versionId, status: 'DRAFT' });
    await expect(
      service.assignVersionToAthlete(trainer, programId, versionId, assignmentInput),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(trainerAthletes.findOne).not.toHaveBeenCalled();
  });

  it('rejects an athlete of a different trainer before writing', async () => {
    trainerAthletes.findOne.mockResolvedValue({
      ...relationship,
      trainerId: 'other-trainer',
    });
    await expect(
      service.assignVersionToAthlete(trainer, programId, versionId, assignmentInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createAssignmentForActiveRelationship).not.toHaveBeenCalled();
  });

  it('rejects inactive relationships before writing', async () => {
    trainerAthletes.findOne.mockResolvedValue({
      ...relationship,
      status: 'TERMINATED',
    });
    await expect(
      service.assignVersionToAthlete(trainer, programId, versionId, assignmentInput),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createAssignmentForActiveRelationship).not.toHaveBeenCalled();
  });

  it.each([
    { code: 'P2002', expected: ConflictException },
    { code: 'P2025', expected: ConflictException },
    { code: 'P2003', expected: NotFoundException },
  ])('maps a concurrent assignment $code to $expected.name', async ({ code, expected }) => {
    repository.createAssignmentForActiveRelationship.mockRejectedValue(prismaError(code));
    await expect(
      service.assignVersionToAthlete(trainer, programId, versionId, assignmentInput),
    ).rejects.toBeInstanceOf(expected);
  });

  it('rejects an assignment invalidated by a repository-level lock', async () => {
    repository.createAssignmentForActiveRelationship.mockResolvedValue(null);
    await expect(
      service.assignVersionToAthlete(trainer, programId, versionId, assignmentInput),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('preserves unexpected assignment write errors', async () => {
    const failure = new Error('Postgres connection lost');
    repository.createAssignmentForActiveRelationship.mockRejectedValue(failure);
    await expect(
      service.assignVersionToAthlete(trainer, programId, versionId, assignmentInput),
    ).rejects.toBe(failure);
  });

  it.each([
    { page: 0, limit: 10 },
    { page: 1.5, limit: 10 },
    { page: 1, limit: 0 },
    { page: 1, limit: 101 },
    { page: 1, limit: Number.NaN },
  ])('refuses invalid assignment pagination %j', async (query) => {
    await expect(service.findManyAssignments(trainer, query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.findManyAssignmentsForParticipant).not.toHaveBeenCalled();
  });

  it('denies assignment list reads after admin promotion, despite a stale session', async () => {
    access.assertAssignmentParticipant.mockRejectedValue(new ForbiddenException());
    await expect(service.findManyAssignments(trainer, { page: 1, limit: 10 })).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.findManyAssignmentsForParticipant).not.toHaveBeenCalled();
  });

  it('scopes a client-specific summary in PostgreSQL before LIMIT/OFFSET/COUNT', async () => {
    const result = { data: [], meta: { total: 0 } };
    repository.findManyAssignments.mockResolvedValue(result);

    const query = {
      page: 2,
      limit: 5,
      trainerAthleteId: relationship.id,
      status: 'COMPLETED' as const,
      view: 'summary' as const,
    };
    await expect(service.findManyAssignments(trainer, query)).resolves.toEqual(result);
    expect(access.assertAssignmentParticipant).toHaveBeenCalledWith(trainer);
    expect(access.assertTrainer).toHaveBeenCalledWith(trainer);
    expect(trainerAthletes.findOne).toHaveBeenCalledWith(relationship.id, trainer);
    expect(repository.findManyAssignmentsForParticipant).not.toHaveBeenCalled();
    expect(repository.findManyAssignments).toHaveBeenCalledWith({
      where: {
        AND: [
          { trainerAthleteId: relationship.id },
          {
            trainerAthlete: {
              is: { id: relationship.id, trainerId: trainer.id, status: 'ACTIVE' },
            },
          },
          { version: { program: { trainerId: trainer.id } } },
          assignmentFullReadWhere(trainer.id),
          { status: 'COMPLETED' },
        ],
      },
      skip: 5,
      take: 5,
      view: 'summary',
    });
  });

  it.each(['PENDING', 'TERMINATED', 'CANCELLED'] as const)(
    'rejects filtered client relation when status is %s without querying assignments',
    async (status) => {
      trainerAthletes.findOne.mockResolvedValue({ ...relationship, status });
      await expect(
        service.findManyAssignments(trainer, {
          page: 1,
          limit: 5,
          view: 'summary',
          trainerAthleteId: relationship.id,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.findManyAssignments).not.toHaveBeenCalled();
    },
  );

  it('returns the same 404 for a foreign or missing filtered relationship', async () => {
    trainerAthletes.findOne.mockResolvedValueOnce({ ...relationship, trainerId: 'another' });
    await expect(
      service.findManyAssignments(trainer, {
        page: 1,
        limit: 5,
        view: 'summary',
        trainerAthleteId: relationship.id,
      }),
    ).rejects.toThrow(NotFoundException);
    trainerAthletes.findOne.mockRejectedValueOnce(new NotFoundException());
    await expect(
      service.findManyAssignments(trainer, {
        page: 1,
        limit: 5,
        view: 'summary',
        trainerAthleteId: relationship.id,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.findManyAssignments).not.toHaveBeenCalled();
  });

  it('rejects nontrainer, revoked and admin filtered read before looking up a relationship', async () => {
    for (const actor of [athlete, admin, trainer]) {
      vi.clearAllMocks();
      if (actor.id === trainer.id) {
        access.assertTrainer.mockRejectedValueOnce(new ForbiddenException('revoked'));
      }
      await expect(
        service.findManyAssignments(actor, {
          page: 1,
          limit: 5,
          view: 'summary',
          trainerAthleteId: relationship.id,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(trainerAthletes.findOne).not.toHaveBeenCalled();
      expect(repository.findManyAssignments).not.toHaveBeenCalled();
    }
  });

  it('rejects unbounded full-mode filtered reads; existing participant full mode is preserved', async () => {
    await expect(
      service.findManyAssignments(trainer, {
        page: 1,
        limit: 5,
        trainerAthleteId: relationship.id,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(trainerAthletes.findOne).not.toHaveBeenCalled();
    expect(repository.findManyAssignments).not.toHaveBeenCalled();
  });

  it('returns one paginated scope containing both trainer and athlete assignments', async () => {
    const result = { data: [], meta: { total: 0 } };
    repository.findManyAssignmentsForParticipant.mockResolvedValue(result);
    const actor: TrainingProgramActor = { id: trainer.id, role: 'ATHLETE' };
    await expect(
      service.findManyAssignments(actor, {
        page: 3,
        limit: 5,
        status: 'ACTIVE',
        view: 'summary',
      }),
    ).resolves.toBe(result);
    expect(access.assertAssignmentParticipant).toHaveBeenCalledWith(actor);
    expect(repository.findManyAssignmentsForParticipant).toHaveBeenCalledExactlyOnceWith(
      {
        where: {
          AND: [assignmentParticipantWhere(actor.id), { status: 'ACTIVE' }],
        },
        skip: 10,
        take: 5,
        view: 'summary',
      },
      actor.id,
    );
  });

  it('does not suppress athlete history for a TRAINER-role dual-capability user', async () => {
    repository.findManyAssignmentsForParticipant.mockResolvedValue({ data: [], meta: {} });
    await service.findManyAssignments(trainer, { page: 1, limit: 20 });
    expect(repository.findManyAssignmentsForParticipant).toHaveBeenCalledWith(
      {
        where: { AND: [assignmentParticipantWhere(trainer.id)] },
        skip: 0,
        take: 20,
      },
      trainer.id,
    );
  });

  it('returns full details for the own-athlete side of an ended assignment', async () => {
    const details = { id: assignmentId, workouts: [{ id: 'workout-1' }] };
    repository.findAssignmentDetailsById.mockResolvedValue(details);
    await expect(service.findOneAssignmentDetails(assignmentId, trainer)).resolves.toBe(details);
    expect(repository.findAssignmentDetailsById).toHaveBeenCalledExactlyOnceWith(
      assignmentId,
      assignmentFullReadWhere(trainer.id),
    );
    expect(repository.findRestrictedAssignmentById).not.toHaveBeenCalled();
  });

  it('redacts a trainer detail read when approval was revoked, even while ACTIVE', async () => {
    repository.findAssignmentDetailsById.mockResolvedValue(null);
    const restricted = { id: assignmentId, status: 'ACTIVE', athlete: { id: athlete.id } };
    repository.findRestrictedAssignmentById.mockResolvedValue(restricted);
    await expect(service.findOneAssignmentDetails(assignmentId, trainer)).resolves.toEqual(
      restricted,
    );
    expect(repository.findRestrictedAssignmentById).toHaveBeenCalledExactlyOnceWith(
      assignmentId,
      assignmentParticipantWhere(trainer.id),
    );
  });

  it('redacts historical trainer details when a relationship is no longer ACTIVE', async () => {
    repository.findAssignmentDetailsById.mockResolvedValue(null);
    repository.findRestrictedAssignmentById.mockResolvedValue({
      id: assignmentId,
      status: 'TERMINATED',
    });
    await expect(service.findOneAssignmentDetails(assignmentId, trainer)).resolves.toMatchObject({
      status: 'TERMINATED',
    });
  });

  it('returns 404 for unrelated users or absent assignments', async () => {
    repository.findAssignmentDetailsById.mockResolvedValue(null);
    repository.findRestrictedAssignmentById.mockResolvedValue(null);
    await expect(service.findOneAssignmentDetails(assignmentId, athlete)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('uses full-or-redacted projections for the basic GET assignment endpoint', async () => {
    const full = { id: assignmentId, athlete: { email: 'athlete@example.com' } };
    repository.findAssignmentById.mockResolvedValueOnce(full).mockResolvedValueOnce(null);
    repository.findRestrictedAssignmentById.mockResolvedValue({
      id: assignmentId,
      athlete: { id: athlete.id },
    });

    await expect(service.findOneAssignment(assignmentId, athlete)).resolves.toBe(full);
    await expect(service.findOneAssignment(assignmentId, trainer)).resolves.toMatchObject({
      id: assignmentId,
    });
    expect(repository.findAssignmentById).toHaveBeenNthCalledWith(
      1,
      assignmentId,
      assignmentFullReadWhere(athlete.id),
    );
    expect(repository.findRestrictedAssignmentById).toHaveBeenCalledWith(
      assignmentId,
      assignmentParticipantWhere(trainer.id),
    );
  });

  it('rejects a formerly permitted session when persisted participant lookup fails', async () => {
    access.assertAssignmentParticipant.mockRejectedValue(new NotFoundException('User not found'));
    await expect(service.findOneAssignment(assignmentId, trainer)).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.findAssignmentById).not.toHaveBeenCalled();
    expect(repository.findRestrictedAssignmentById).not.toHaveBeenCalled();
  });

  it("forbids completing someone else's assignment even with athlete capability", async () => {
    await expect(service.completeAssignment(assignmentId, trainer)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.completeAssignmentIfNoUnfinishedWorkouts).not.toHaveBeenCalled();
  });

  it('allows a TRAINER-role account to complete its own athlete-side assignment', async () => {
    repository.findAssignmentById.mockResolvedValue({
      ...activeAssignment,
      athleteId: trainer.id,
    });
    repository.completeAssignmentIfNoUnfinishedWorkouts.mockResolvedValue({
      status: 'COMPLETED',
      assignment: { id: assignmentId, status: 'COMPLETED' },
    });

    await expect(service.completeAssignment(assignmentId, trainer)).resolves.toMatchObject({
      status: 'COMPLETED',
    });
    expect(repository.completeAssignmentIfNoUnfinishedWorkouts).toHaveBeenCalledWith({
      assignmentId,
      athleteId: trainer.id,
      completedAt: expect.any(Date),
    });
  });

  it('rejects completion after admin promotion despite a stale ATHLETE session', async () => {
    access.assertAssignmentParticipant.mockRejectedValue(new ForbiddenException());
    await expect(service.completeAssignment(assignmentId, athlete)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.completeAssignmentIfNoUnfinishedWorkouts).not.toHaveBeenCalled();
  });

  it('refuses completion of an already completed assignment', async () => {
    repository.findAssignmentById.mockResolvedValue({
      ...activeAssignment,
      status: 'COMPLETED',
    });
    await expect(service.completeAssignment(assignmentId, athlete)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.completeAssignmentIfNoUnfinishedWorkouts).not.toHaveBeenCalled();
  });

  it('atomically completes an active assignment for its athlete', async () => {
    const completed = { id: assignmentId, status: 'COMPLETED' };
    repository.completeAssignmentIfNoUnfinishedWorkouts.mockResolvedValue({
      status: 'COMPLETED',
      assignment: completed,
    });
    await expect(service.completeAssignment(assignmentId, athlete)).resolves.toBe(completed);
    expect(repository.completeAssignmentIfNoUnfinishedWorkouts).toHaveBeenCalledExactlyOnceWith({
      assignmentId,
      athleteId: athlete.id,
      completedAt: expect.any(Date),
    });
  });

  it('reports remaining unfinished workouts using the repository count', async () => {
    repository.completeAssignmentIfNoUnfinishedWorkouts.mockResolvedValue({
      status: 'HAS_UNFINISHED_WORKOUTS',
      unfinishedCount: 2,
    });
    await expect(service.completeAssignment(assignmentId, athlete)).rejects.toThrow(
      '2 unfinished workout(s) remain',
    );
  });

  it('maps a concurrent state change discovered during completion to conflict', async () => {
    repository.completeAssignmentIfNoUnfinishedWorkouts.mockResolvedValue({
      status: 'NOT_ACTIVE',
    });
    await expect(service.completeAssignment(assignmentId, athlete)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not turn unexpected completion errors into successful completion', async () => {
    const failure = new Error('Transaction rolled back');
    repository.completeAssignmentIfNoUnfinishedWorkouts.mockRejectedValue(failure);
    await expect(service.completeAssignment(assignmentId, athlete)).rejects.toBe(failure);
  });

  it('forbids cancellation when trainer capability is not active', async () => {
    await expect(service.cancelAssignment(assignmentId, athlete)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.cancelAssignmentIfTrainerEligible).not.toHaveBeenCalled();
  });

  it('allows approved ATHLETE-role trainers to cancel their own assignments', async () => {
    const approvedTrainer: TrainingProgramActor = { id: trainer.id, role: 'ATHLETE' };
    access.assertTrainer.mockResolvedValueOnce(undefined);
    repository.cancelAssignmentIfTrainerEligible.mockResolvedValue({
      ...activeAssignment,
      status: 'CANCELLED',
    });
    await expect(service.cancelAssignment(assignmentId, approvedTrainer)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
    expect(access.assertTrainer).toHaveBeenCalledWith(approvedTrainer);
    expect(repository.cancelAssignmentIfTrainerEligible).toHaveBeenCalledOnce();
  });

  it("rejects trainer cancellation of another trainer's assignment", async () => {
    repository.findAssignmentById.mockResolvedValue({
      ...activeAssignment,
      assignedById: 'other-trainer',
    });
    await expect(service.cancelAssignment(assignmentId, trainer)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.cancelAssignmentIfTrainerEligible).not.toHaveBeenCalled();
  });

  it('rejects cancellation when the relationship trainer differs from the actor', async () => {
    repository.findAssignmentById.mockResolvedValue({
      ...activeAssignment,
      trainerAthlete: { trainerId: 'other-trainer' },
    });
    await expect(service.cancelAssignment(assignmentId, trainer)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.cancelAssignmentIfTrainerEligible).not.toHaveBeenCalled();
  });

  it('refuses cancellation of an already ended assignment', async () => {
    repository.findAssignmentById.mockResolvedValue({
      ...activeAssignment,
      status: 'CANCELLED',
    });
    await expect(service.cancelAssignment(assignmentId, trainer)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.cancelAssignmentIfTrainerEligible).not.toHaveBeenCalled();
  });

  it('trims the cancellation reason and writes only through guarded repository mutation', async () => {
    const cancelled = { id: assignmentId, status: 'CANCELLED' };
    repository.cancelAssignmentIfTrainerEligible.mockResolvedValue(cancelled);
    await expect(
      service.cancelAssignment(assignmentId, trainer, {
        reason: '  Assigned new program  ',
      }),
    ).resolves.toBe(cancelled);
    expect(repository.cancelAssignmentIfTrainerEligible).toHaveBeenCalledExactlyOnceWith({
      assignmentId,
      trainerId: trainer.id,
      endedAt: expect.any(Date),
      reason: 'Assigned new program',
    });
  });

  it.each([{ reason: undefined }, { reason: null }, { reason: '   ' }])(
    'normalizes a missing or blank reason to null %j',
    async (input) => {
      await service.cancelAssignment(assignmentId, trainer, input);
      expect(repository.cancelAssignmentIfTrainerEligible).toHaveBeenCalledWith(
        expect.objectContaining({ reason: null }),
      );
    },
  );

  it('returns conflict when current trainer authorization or relationship changed during the transaction', async () => {
    repository.cancelAssignmentIfTrainerEligible.mockResolvedValue(null);
    await expect(service.cancelAssignment(assignmentId, trainer)).rejects.toThrow(
      ConflictException,
    );
  });

  it('refuses a stale TRAINER-role actor whose persisted trainer approval was revoked', async () => {
    access.assertTrainer.mockRejectedValue(new ForbiddenException());
    await expect(service.cancelAssignment(assignmentId, trainer)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.cancelAssignmentIfTrainerEligible).not.toHaveBeenCalled();
  });

  it('maps an already-ended concurrent cancellation to conflict', async () => {
    repository.cancelAssignmentIfTrainerEligible.mockRejectedValue(prismaError('P2025'));
    await expect(service.cancelAssignment(assignmentId, trainer)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('preserves unexpected cancellation write errors for diagnostics', async () => {
    const failure = new Error('Database unavailable');
    repository.cancelAssignmentIfTrainerEligible.mockRejectedValue(failure);
    await expect(service.cancelAssignment(assignmentId, trainer)).rejects.toBe(failure);
  });

  it('does not expose assignment completion to non-participant administrators', async () => {
    await expect(service.completeAssignment(assignmentId, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.findAssignmentById).not.toHaveBeenCalled();
  });
});
