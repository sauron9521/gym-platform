import { NotFoundException } from '@nestjs/common';

import { UsersRepository } from '../repositories/users.repository.js';
import { UsersService } from '../services/users.service.js';

describe('UsersService', () => {
  const repository = {
    findMe: vi.fn(),
    findCapabilitySnapshot: vi.fn(),
    findCapabilitySnapshotForWrite: vi.fn(),
    upsertMyProfile: vi.fn(),
    updateMyPreferences: vi.fn(),
    replaceAvatar: vi.fn(),
  };
  const avatarService = { removePrevious: vi.fn() };
  let service: UsersService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new UsersService(repository as unknown as UsersRepository, avatarService as never);
  });

  it('derives grants from current DB state, and removes trainer access after revocation', async () => {
    repository.findCapabilitySnapshot
      .mockResolvedValueOnce({ role: 'ATHLETE', trainerProfile: { isActive: true } })
      .mockResolvedValueOnce({ role: 'ATHLETE', trainerProfile: { isActive: false } });

    await expect(service.findMyCapabilities('user-1')).resolves.toEqual({
      athlete: true,
      trainer: true,
      admin: false,
    });
    await expect(service.findMyCapabilities('user-1')).resolves.toEqual({
      athlete: true,
      trainer: false,
      admin: false,
    });
    expect(repository.findCapabilitySnapshot).toHaveBeenCalledTimes(2);
    expect(repository.findCapabilitySnapshot).toHaveBeenNthCalledWith(1, 'user-1');
    expect(repository.findCapabilitySnapshot).toHaveBeenNthCalledWith(2, 'user-1');
  });

  it('fails closed for an inactive or deleted account', async () => {
    repository.findCapabilitySnapshot.mockResolvedValue(null);
    await expect(service.findMyCapabilities('gone')).rejects.toThrow(NotFoundException);
  });

  it('checks live trainer capability without granting it to a revoked profile', async () => {
    repository.findCapabilitySnapshot
      .mockResolvedValueOnce({ role: 'ATHLETE', trainerProfile: { isActive: true } })
      .mockResolvedValueOnce({ role: 'ATHLETE', trainerProfile: { isActive: false } })
      .mockResolvedValueOnce({ role: 'TRAINER', trainerProfile: null })
      .mockResolvedValueOnce({ role: 'TRAINER', trainerProfile: { isActive: false } })
      .mockResolvedValueOnce({ role: 'ADMIN', trainerProfile: { isActive: true } })
      .mockResolvedValueOnce(null);
    for (const granted of [true, false, true, false, false, false]) {
      await expect(service.hasTrainerCapability('actor-1')).resolves.toBe(granted);
    }
    expect(repository.findCapabilitySnapshot).toHaveBeenCalledTimes(6);
  });

  it('does not grant trainer access if the capability lookup fails', async () => {
    repository.findCapabilitySnapshot.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.hasTrainerCapability('actor-1')).rejects.toThrow('Database unavailable');
  });

  it('uses persisted capability derivation under the caller transaction lock', async () => {
    const tx = { id: 'write-tx' } as never;
    repository.findCapabilitySnapshotForWrite
      .mockResolvedValueOnce({ role: 'ATHLETE', trainerProfile: { isActive: true } })
      .mockResolvedValueOnce({ role: 'TRAINER', trainerProfile: null })
      .mockResolvedValueOnce({ role: 'TRAINER', trainerProfile: { isActive: false } })
      .mockResolvedValueOnce({ role: 'ADMIN', trainerProfile: { isActive: true } })
      .mockResolvedValueOnce(null);

    await expect(service.assertTrainerCapabilityForWrite(tx, 'actor-1')).resolves.toBeUndefined();
    await expect(service.assertTrainerCapabilityForWrite(tx, 'actor-1')).resolves.toBeUndefined();
    for (let index = 0; index < 3; index++) {
      await expect(service.assertTrainerCapabilityForWrite(tx, 'actor-1')).rejects.toThrow(
        'Only active trainers',
      );
    }
    expect(repository.findCapabilitySnapshotForWrite).toHaveBeenCalledTimes(5);
    expect(repository.findCapabilitySnapshotForWrite).toHaveBeenCalledWith(tx, 'actor-1');
  });

  it('fails closed if the locked capability query itself fails', async () => {
    repository.findCapabilitySnapshotForWrite.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.assertTrainerCapabilityForWrite({} as never, 'actor-1')).rejects.toThrow(
      'Database unavailable',
    );
  });

  it('returns the canonical full capability snapshot under held User/Profile locks', async () => {
    const tx = { id: 'write-tx' } as never;
    repository.findCapabilitySnapshotForWrite
      .mockResolvedValueOnce({ role: 'ATHLETE', trainerProfile: { isActive: true } })
      .mockResolvedValueOnce({ role: 'TRAINER', trainerProfile: { isActive: false } })
      .mockResolvedValueOnce({ role: 'ADMIN', trainerProfile: null })
      .mockResolvedValueOnce(null);

    await expect(service.findMyCapabilitiesForWrite(tx, 'actor')).resolves.toEqual({
      athlete: true,
      trainer: true,
      admin: false,
    });
    await expect(service.findMyCapabilitiesForWrite(tx, 'actor')).resolves.toEqual({
      athlete: true,
      trainer: false,
      admin: false,
    });
    await expect(service.findMyCapabilitiesForWrite(tx, 'actor')).resolves.toEqual({
      athlete: false,
      trainer: false,
      admin: true,
    });
    await expect(service.findMyCapabilitiesForWrite(tx, 'actor')).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.findCapabilitySnapshotForWrite).toHaveBeenCalledTimes(4);
  });

  it('returns a user without a profile as profile: null', async () => {
    repository.findMe.mockResolvedValue({
      id: 'user-1',
      email: 'athlete@example.com',
      role: 'ATHLETE',
      profile: null,
    });

    await expect(service.findMe('user-1')).resolves.toMatchObject({
      id: 'user-1',
      profile: null,
    });
    expect(repository.findMe).toHaveBeenCalledWith('user-1');
  });

  it('updates an account locale independently from the personal profile', async () => {
    repository.updateMyPreferences.mockResolvedValue({
      id: 'user-1',
      preferredLocale: 'en',
      profile: null,
    });
    await expect(
      service.updateMyPreferences('user-1', { preferredLocale: 'en' }),
    ).resolves.toMatchObject({
      preferredLocale: 'en',
      profile: null,
    });
    expect(repository.updateMyPreferences).toHaveBeenCalledExactlyOnceWith('user-1', 'en');
  });

  it('formats birthday as a date-only string', async () => {
    repository.findMe.mockResolvedValue({
      id: 'user-1',
      email: 'athlete@example.com',
      profile: {
        name: 'Athlete',
        birthday: new Date('1998-03-04T00:00:00.000Z'),
        height: 193,
        weight: { toString: () => '81.25' },
      },
    });
    await expect(service.findMe('user-1')).resolves.toMatchObject({
      profile: {
        birthday: '1998-03-04',
        height: 193,
        weight: 81.25,
      },
    });
  });

  it('returns 404 when the current user does not exist', async () => {
    repository.findMe.mockResolvedValue(null);
    await expect(service.findMe('missing')).rejects.toThrow(NotFoundException);
  });

  it('sends partial updates as date-safe Prisma values', async () => {
    repository.upsertMyProfile.mockResolvedValue({
      id: 'user-1',
      profile: {
        birthday: new Date('1998-03-04T00:00:00.000Z'),
        name: 'Athlete',
        height: null,
        weight: { toString: () => '21.50' },
      },
    });

    const result = await service.updateMe('user-1', {
      name: 'Athlete',
      birthday: '1998-03-04',
      weight: 21.5,
    });

    expect(repository.upsertMyProfile).toHaveBeenCalledWith('user-1', {
      name: 'Athlete',
      displayName: 'Athlete',
      firstName: undefined,
      lastName: undefined,
      avatarUrl: undefined,
      timezone: undefined,
      birthday: new Date('1998-03-04T00:00:00.000Z'),
      height: undefined,
      weight: 21.5,
    });
    expect(result.profile?.birthday).toBe('1998-03-04');
    expect(result.profile?.weight).toBe(21.5);
  });

  it('allows clearing nullable profile fields', async () => {
    repository.upsertMyProfile.mockResolvedValue({
      id: 'user-1',
      profile: {
        name: null,
        birthday: null,
        height: null,
        weight: null,
      },
    });

    const result = await service.updateMe('user-1', {
      name: null,
      birthday: null,
    });
    expect(result.profile?.name).toBeNull();
    expect(repository.upsertMyProfile).toHaveBeenCalledWith('user-1', {
      name: null,
      displayName: null,
      firstName: undefined,
      lastName: undefined,
      avatarUrl: undefined,
      timezone: undefined,
      birthday: null,
      height: undefined,
      weight: undefined,
    });
  });
  it('mirrors displayName into the legacy name field', async () => {
    repository.replaceAvatar.mockResolvedValue({
      user: {
        id: 'user-1',
        profile: {
          name: 'Anna S.',
          displayName: 'Anna S.',
          firstName: 'Anna',
          lastName: 'Smith',
          avatarUrl: 'https://cdn.example.com/avatar.jpg',
          timezone: 'Europe/Kyiv',
          birthday: null,
          weight: null,
        },
      },
      previousKey: null,
    });

    const response = await service.updateMe('user-1', {
      firstName: 'Anna',
      lastName: 'Smith',
      displayName: 'Anna S.',
      avatarUrl: 'https://cdn.example.com/avatar.jpg',
      timezone: 'Europe/Kyiv',
    });

    expect(repository.replaceAvatar).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'Anna S.',
        displayName: 'Anna S.',
        firstName: 'Anna',
        lastName: 'Smith',
        avatarUrl: 'https://cdn.example.com/avatar.jpg',
        timezone: 'Europe/Kyiv',
      }),
      null,
    );
    expect(response.profile).toMatchObject({
      name: 'Anna S.',
      displayName: 'Anna S.',
    });
  });

  it('does not overwrite name when patching timezone only', async () => {
    repository.upsertMyProfile.mockResolvedValue({
      id: 'user-1',
      profile: {
        name: 'Legacy',
        displayName: 'Legacy',
        timezone: 'Europe/Kyiv',
        birthday: null,
        weight: null,
      },
    });

    await service.updateMe('user-1', { timezone: 'Europe/Kyiv' });
    expect(repository.upsertMyProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: undefined,
        displayName: undefined,
        timezone: 'Europe/Kyiv',
      }),
    );
  });

  it('releases a managed avatar when switching to an external URL', async () => {
    repository.replaceAvatar.mockResolvedValue({
      user: {
        id: 'user-1',
        profile: { avatarUrl: 'https://example.com/new.png', weight: null, birthday: null },
      },
      previousKey: '12345678-1234-4123-8123-123456789abc.png',
    });
    await service.updateMe('user-1', {
      avatarUrl: 'https://example.com/new.png',
    });
    expect(repository.replaceAvatar).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ avatarUrl: 'https://example.com/new.png' }),
      null,
    );
    expect(avatarService.removePrevious).toHaveBeenCalledWith(
      '12345678-1234-4123-8123-123456789abc.png',
    );
  });
});
