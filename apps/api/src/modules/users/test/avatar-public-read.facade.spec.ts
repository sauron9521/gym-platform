import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AvatarPublicReadFacade } from '../avatar/avatar-public-read.facade.js';

describe('AvatarPublicReadFacade', () => {
  it('delegates the validated public read and preserves results and errors', async () => {
    const key = '11111111-1111-4111-8111-111111111111.png';
    const avatar = { bytes: Buffer.from('image'), contentType: 'image/png' };
    const avatars = { readPublic: vi.fn().mockResolvedValue(avatar) };
    const facade = new AvatarPublicReadFacade(avatars as never);
    await expect(facade.readPublic(key)).resolves.toBe(avatar);
    expect(avatars.readPublic).toHaveBeenCalledExactlyOnceWith(key);
    avatars.readPublic.mockRejectedValueOnce(new NotFoundException('Avatar not found'));
    await expect(facade.readPublic(key)).rejects.toThrow(NotFoundException);
  });
});
