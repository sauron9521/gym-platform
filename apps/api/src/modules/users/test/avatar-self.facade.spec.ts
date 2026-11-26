import { describe, expect, it, vi } from 'vitest';

import { AvatarSelfFacade } from '../avatar/avatar-self.facade.js';

describe('AvatarSelfFacade', () => {
  it('delegates the account-scoped commands and preserves results and errors', async () => {
    const avatars = {
      upload: vi.fn().mockResolvedValue({ avatarUrl: '/avatars/test.png' }),
      delete: vi.fn().mockResolvedValue({ avatarUrl: null }),
    };
    const facade = new AvatarSelfFacade(avatars as never);
    const file = { buffer: Buffer.from('test'), size: 4, mimetype: 'image/png' };
    await expect(facade.upload('user-1', file)).resolves.toEqual({
      avatarUrl: '/avatars/test.png',
    });
    expect(avatars.upload).toHaveBeenCalledExactlyOnceWith('user-1', file);
    await expect(facade.delete('user-1')).resolves.toEqual({ avatarUrl: null });
    expect(avatars.delete).toHaveBeenCalledExactlyOnceWith('user-1');
    avatars.upload.mockRejectedValueOnce(new Error('Invalid image'));
    await expect(facade.upload('user-1')).rejects.toThrow('Invalid image');
  });
});
