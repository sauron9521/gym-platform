import { PasswordHasher } from '@nestjs/authentication';
import { randomUUID } from 'node:crypto';
import type { User } from '#prisma/client';
import { UsersAuthFacade } from '#src/modules/users/services/users-auth.facade';
import { CredentialsService } from '../../services/index.js';
import type { UserResponse } from '#src/modules/users/types/user-payload.types';
import { SignInDto } from '../../dto/auth.dto.js';

describe('Credentials service', () => {
  let service: CredentialsService;

  const userRepository = {
    checkEmail: vi.fn(),
    create: vi.fn(),
    findCredentials: vi.fn(),
    updatePassHash: vi.fn(),
  };

  const passwordHasher = {
    hash: vi.fn(),
    verify: vi.fn(),
    needsRehash: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    service = new CredentialsService(
      userRepository as unknown as UsersAuthFacade,
      passwordHasher as unknown as PasswordHasher,
    );
  });

  describe('register', () => {
    it('Should hash the password and create user', async () => {
      const dto: SignInDto = {
        email: 'test123@example.com',
        password: 'StrongPassword123!@',
      };

      const createUser = {
        id: 'user-1',
        email: dto.email,
      } as UserResponse;

      passwordHasher.hash.mockResolvedValue('hashed-password');
      userRepository.create.mockResolvedValue(createUser);

      const result = await service.register(dto);

      expect(userRepository.checkEmail).toHaveBeenCalledWith(dto.email);
      expect(passwordHasher.hash).toHaveBeenCalledWith(dto.password);
      expect(userRepository.create).toHaveBeenCalledWith(dto.email, 'hashed-password');
      expect(result).toEqual(createUser);
    });

    it('should not created a user if the email already exists', async () => {
      const error = new Error('Email already exists');
      userRepository.checkEmail.mockRejectedValue(error);

      await expect(
        service.register({
          email: 'test@exaple.com',
          password: 'StrongPassword123!@',
        }),
      ).rejects.toBe(error);

      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should return null when the password is invalid', async () => {
      const user = {
        id: randomUUID(),
        email: 'test@example.com',
        passwordHash: 'stored-hash',
      } as unknown as User;

      userRepository.findCredentials.mockResolvedValue(user);
      passwordHasher.verify.mockResolvedValue(false);

      const result = await service.verify('test@example.com', 'WrongPassword123!@');

      expect(result).toBeNull();
      expect(passwordHasher.verify).toHaveBeenCalledWith('WrongPassword123!@', 'stored-hash');
      expect(passwordHasher.needsRehash).not.toHaveBeenCalled();
    });

    it('should return the user without the password hash', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        role: 'ATHLETE' as const,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        updatedAt: new Date('2026-10-01T10:00:00.000Z'),
        passwordHash: 'store-hash',
      };

      userRepository.findCredentials.mockResolvedValue(user);
      passwordHasher.verify.mockResolvedValue(true);
      passwordHasher.needsRehash.mockResolvedValue(false);

      const result = await service.verify(user.email, 'StrongPassword123!@');

      expect(result).toEqual({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it("should return null the user doesn't exist", async () => {
      userRepository.findCredentials.mockResolvedValue(null);

      const result = await service.verify('misssing@examle.com', 'StrongPassword123!@');

      expect(result).toBeNull();
      expect(userRepository.findCredentials).toHaveBeenCalledWith('misssing@examle.com');
    });

    it('should rehash the password when the store hash needs updating', async () => {
      const user = {
        id: randomUUID(),
        email: 'test@example.com',
        emailVerified: true,
        role: 'ATHLETE' as const,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        updatedAt: new Date('2026-10-02T10:00:00.000Z'),
        passwordHash: 'old-hash',
      };

      userRepository.findCredentials.mockResolvedValue(user);
      passwordHasher.verify.mockResolvedValue(true);
      passwordHasher.needsRehash.mockResolvedValue(true);
      passwordHasher.hash.mockResolvedValue('new-hash');

      const result = await service.verify('test@exmaple.com', 'StrongPassword123!');

      expect(passwordHasher.needsRehash).toHaveBeenCalledWith('old-hash');
      expect(passwordHasher.hash).toHaveBeenCalledWith('StrongPassword123!');
      expect(userRepository.updatePassHash).toHaveBeenCalledWith(user.id, 'new-hash');
      expect(result).toEqual({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('credential persistence and failure safety', () => {
    const persistedUser = {
      id: 'user-safe-1',
      email: 'athlete@example.test',
      emailVerified: true,
      role: 'ATHLETE' as const,
      createdAt: new Date('2026-11-01T10:00:00.000Z'),
      updatedAt: new Date('2026-11-01T10:00:00.000Z'),
      passwordHash: 'persisted-hash',
    };

    it('does not create an account when hashing the password fails', async () => {
      const error = new Error('Password hashing failed');
      passwordHasher.hash.mockRejectedValueOnce(error);

      await expect(
        service.register({ email: persistedUser.email, password: 'ValidPassword123!' }),
      ).rejects.toBe(error);

      expect(userRepository.checkEmail).toHaveBeenCalledOnce();
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('does not silently succeed when account persistence fails', async () => {
      const error = new Error('User insert failed');
      passwordHasher.hash.mockResolvedValueOnce('hashed-password');
      userRepository.create.mockRejectedValueOnce(error);

      await expect(
        service.register({ email: persistedUser.email, password: 'ValidPassword123!' }),
      ).rejects.toBe(error);

      expect(userRepository.create).toHaveBeenCalledWith(persistedUser.email, 'hashed-password');
    });

    it('performs a password check for unknown users without touching rehash storage', async () => {
      userRepository.findCredentials.mockResolvedValueOnce(null);
      passwordHasher.verify.mockResolvedValueOnce(false);

      await expect(service.verify('unknown@example.test', 'InvalidPassword!')).resolves.toBeNull();

      expect(passwordHasher.verify).toHaveBeenCalledWith('InvalidPassword!', undefined);
      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(passwordHasher.needsRehash).not.toHaveBeenCalled();
      expect(userRepository.updatePassHash).not.toHaveBeenCalled();
    });

    it('never attempts a password upgrade after invalid credentials', async () => {
      userRepository.findCredentials.mockResolvedValueOnce(persistedUser);
      passwordHasher.verify.mockResolvedValueOnce(false);

      await expect(service.verify(persistedUser.email, 'WrongPassword!')).resolves.toBeNull();

      expect(passwordHasher.needsRehash).not.toHaveBeenCalled();
      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(userRepository.updatePassHash).not.toHaveBeenCalled();
    });

    it('does not rehash an already-current password', async () => {
      userRepository.findCredentials.mockResolvedValueOnce(persistedUser);
      passwordHasher.verify.mockResolvedValueOnce(true);
      passwordHasher.needsRehash.mockReturnValueOnce(false);

      const result = await service.verify(persistedUser.email, 'ValidPassword123!');

      expect(result?.id).toBe(persistedUser.id);
      expect(result).not.toHaveProperty('passwordHash');
      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(userRepository.updatePassHash).not.toHaveBeenCalled();
    });

    it('does not return an authenticated identity if rehashing fails', async () => {
      const error = new Error('Hasher unavailable');
      userRepository.findCredentials.mockResolvedValueOnce(persistedUser);
      passwordHasher.verify.mockResolvedValueOnce(true);
      passwordHasher.needsRehash.mockReturnValueOnce(true);
      passwordHasher.hash.mockRejectedValueOnce(error);

      await expect(service.verify(persistedUser.email, 'ValidPassword123!')).rejects.toBe(error);

      expect(userRepository.updatePassHash).not.toHaveBeenCalled();
    });

    it('propagates a password-upgrade write failure instead of issuing a login', async () => {
      const error = new Error('Credential update failed');
      userRepository.findCredentials.mockResolvedValueOnce(persistedUser);
      passwordHasher.verify.mockResolvedValueOnce(true);
      passwordHasher.needsRehash.mockReturnValueOnce(true);
      passwordHasher.hash.mockResolvedValueOnce('upgraded-hash');
      userRepository.updatePassHash.mockRejectedValueOnce(error);

      await expect(service.verify(persistedUser.email, 'ValidPassword123!')).rejects.toBe(error);

      expect(userRepository.updatePassHash).toHaveBeenCalledWith(persistedUser.id, 'upgraded-hash');
    });

    it('propagates credential lookup errors without running the hasher', async () => {
      const error = new Error('Credentials storage unavailable');
      userRepository.findCredentials.mockRejectedValueOnce(error);

      await expect(service.verify(persistedUser.email, 'ValidPassword123!')).rejects.toBe(error);

      expect(passwordHasher.verify).not.toHaveBeenCalled();
      expect(passwordHasher.needsRehash).not.toHaveBeenCalled();
      expect(userRepository.updatePassHash).not.toHaveBeenCalled();
    });
  });
});
