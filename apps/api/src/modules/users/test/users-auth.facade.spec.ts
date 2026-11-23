import { describe, expect, it, vi } from 'vitest';

import type { UsersRepository } from '../repositories/users.repository.js';
import { UsersAuthFacade } from '../services/users-auth.facade.js';

function setup() {
  const repository = {
    checkEmail: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: 'new-user' }),
    findCredentials: vi.fn().mockResolvedValue({ id: 'user', passwordHash: 'hash' }),
    updatePassHash: vi.fn().mockResolvedValue(undefined),
    findUserForJwtAuth: vi.fn().mockResolvedValue({ id: 'jwt-user' }),
    findUserById: vi.fn().mockResolvedValue({ id: 'session-user' }),
    getPreferredMailLocale: vi.fn().mockResolvedValue('uk'),
    markEmailVerified: vi.fn().mockResolvedValue(true),
  };
  return {
    repository,
    facade: new UsersAuthFacade(repository as unknown as UsersRepository),
  };
}

describe('UsersAuthFacade', () => {
  it('delegates all Auth operations to the canonical Users repository', async () => {
    const { facade, repository } = setup();

    await expect(facade.checkEmail('person@example.test')).resolves.toBeUndefined();
    await expect(facade.create('person@example.test', 'new-hash')).resolves.toEqual({
      id: 'new-user',
    });
    await expect(facade.findCredentials('person@example.test')).resolves.toEqual({
      id: 'user',
      passwordHash: 'hash',
    });
    await expect(facade.updatePassHash('user', 'next-hash')).resolves.toBeUndefined();
    await expect(facade.findUserForJwtAuth('jwt-user', 1700000000)).resolves.toEqual({
      id: 'jwt-user',
    });
    await expect(facade.findUserById('session-user')).resolves.toEqual({
      id: 'session-user',
    });
    await expect(facade.getPreferredMailLocale('person@example.test')).resolves.toBe('uk');
    await expect(facade.markEmailVerified('user', 'person@example.test')).resolves.toBe(true);

    expect(repository.checkEmail).toHaveBeenCalledExactlyOnceWith('person@example.test');
    expect(repository.create).toHaveBeenCalledExactlyOnceWith('person@example.test', 'new-hash');
    expect(repository.findCredentials).toHaveBeenCalledExactlyOnceWith('person@example.test');
    expect(repository.updatePassHash).toHaveBeenCalledExactlyOnceWith('user', 'next-hash');
    expect(repository.findUserForJwtAuth).toHaveBeenCalledExactlyOnceWith('jwt-user', 1700000000);
    expect(repository.findUserById).toHaveBeenCalledExactlyOnceWith('session-user');
    expect(repository.getPreferredMailLocale).toHaveBeenCalledExactlyOnceWith(
      'person@example.test',
    );
    expect(repository.markEmailVerified).toHaveBeenCalledExactlyOnceWith(
      'user',
      'person@example.test',
    );
  });

  it('does not mask missing users or swallow repository errors', async () => {
    const { facade, repository } = setup();
    repository.findUserForJwtAuth.mockResolvedValueOnce(null);
    await expect(facade.findUserForJwtAuth('revoked-user')).resolves.toBeNull();

    const error = new Error('Database request failed');
    repository.findCredentials.mockRejectedValueOnce(error);
    await expect(facade.findCredentials('person@example.test')).rejects.toBe(error);
  });
});
