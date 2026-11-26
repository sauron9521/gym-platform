import { UsersController } from '../../controllers/users.controller.js';
import type { UsersService, AvatarSelfFacade } from '#src/modules/users/public-api';

describe('UsersController', () => {
  const usersService = {
    findMe: vi.fn(),
    findMyCapabilities: vi.fn(),
    updateMe: vi.fn(),
    updateMyPreferences: vi.fn(),
    findMyWorkoutPreferences: vi.fn(),
    updateMyWorkoutPreferences: vi.fn(),
    initializeMyWorkoutPreferences: vi.fn(),
  };
  const avatarService = {
    upload: vi.fn(),
    delete: vi.fn(),
  };
  const actor = { id: 'user-1' };
  let controller: UsersController;

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new UsersController(
      usersService as unknown as UsersService,
      avatarService as unknown as AvatarSelfFacade,
    );
  });

  it('reads only the session owner capabilities, without a user-provided ID', async () => {
    const grants = { athlete: true, trainer: false, admin: false };
    usersService.findMyCapabilities.mockResolvedValue(grants);
    await expect(controller.myCapabilities(actor)).resolves.toBe(grants);
    expect(usersService.findMyCapabilities).toHaveBeenCalledExactlyOnceWith(actor.id);
  });

  it('reads the authenticated user profile without a client-provided user ID', async () => {
    const profile = { id: actor.id, email: 'athlete@example.test', profile: null };
    usersService.findMe.mockResolvedValue(profile);

    await expect(controller.me(actor)).resolves.toBe(profile);
    expect(usersService.findMe).toHaveBeenCalledExactlyOnceWith(actor.id);
  });

  it('delegates profile updates with the authenticated user ID and decimal weight', async () => {
    const body = { displayName: 'Athlete', weight: 81.25 };
    const profile = { id: actor.id, profile: body };
    usersService.updateMe.mockResolvedValue(profile);

    await expect(controller.updateMe(actor, body)).resolves.toBe(profile);
    expect(usersService.updateMe).toHaveBeenCalledExactlyOnceWith(actor.id, body);
  });

  it('updates preferences only for the authenticated actor', async () => {
    const body = { preferredLocale: 'uk' as const };
    usersService.updateMyPreferences.mockResolvedValue({ id: actor.id, preferredLocale: 'uk' });
    await controller.updatePreferences(actor, body);
    expect(usersService.updateMyPreferences).toHaveBeenCalledExactlyOnceWith(actor.id, body);
  });

  it('reads and changes only the authenticated actor workout preferences', async () => {
    const initial = { autoRestTimer: null, restDurationSeconds: null };
    const updated = { autoRestTimer: false, restDurationSeconds: null };
    usersService.findMyWorkoutPreferences.mockResolvedValue(initial);
    usersService.updateMyWorkoutPreferences.mockResolvedValue(updated);
    await expect(controller.myWorkoutPreferences(actor)).resolves.toEqual(initial);
    await expect(
      controller.updateWorkoutPreferences(actor, { autoRestTimer: false }),
    ).resolves.toEqual(updated);
    expect(usersService.findMyWorkoutPreferences).toHaveBeenCalledExactlyOnceWith(actor.id);
    expect(usersService.updateMyWorkoutPreferences).toHaveBeenCalledExactlyOnceWith(actor.id, {
      autoRestTimer: false,
    });
  });

  it('imports legacy workout preferences only for the authenticated actor', async () => {
    const input = { autoRestTimer: false, restDurationSeconds: 120 as const };
    const canonical = { autoRestTimer: true, restDurationSeconds: 120 };
    usersService.initializeMyWorkoutPreferences.mockResolvedValue(canonical);
    await expect(controller.initializeWorkoutPreferences(actor, input)).resolves.toEqual(canonical);
    expect(usersService.initializeMyWorkoutPreferences).toHaveBeenCalledExactlyOnceWith(
      actor.id,
      input,
    );
  });

  it('forwards the multipart upload as-is to the avatar service', async () => {
    const file = { buffer: Buffer.from('test-data'), size: 9, mimetype: 'image/png' };
    const result = { avatarUrl: '/avatars/example.png' };
    avatarService.upload.mockResolvedValue(result);

    await expect(controller.uploadAvatar(actor, file)).resolves.toBe(result);
    expect(avatarService.upload).toHaveBeenCalledExactlyOnceWith(actor.id, file);
  });

  it('preserves missing-file validation delegation to the avatar service', async () => {
    const error = new Error('Missing avatar file');
    avatarService.upload.mockRejectedValue(error);

    await expect(controller.uploadAvatar(actor, undefined)).rejects.toBe(error);
    expect(avatarService.upload).toHaveBeenCalledExactlyOnceWith(actor.id, undefined);
  });

  it('deletes the avatar for the authenticated account only', async () => {
    const result = { avatarUrl: null };
    avatarService.delete.mockResolvedValue(result);

    await expect(controller.deleteAvatar(actor)).resolves.toBe(result);
    expect(avatarService.delete).toHaveBeenCalledExactlyOnceWith(actor.id);
  });
});
