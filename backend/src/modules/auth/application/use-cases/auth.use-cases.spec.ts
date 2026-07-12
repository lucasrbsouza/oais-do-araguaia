import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../../../audit/audit.service';
import { UnauthorizedError } from '../../../../shared/domain/domain-error';
import { UserRepository } from '../../../users/domain/user.repository';
import { RefreshTokenRepository } from '../../domain/refresh-token.repository';
import { TokenService } from '../token.service';
import { LoginUseCase } from './login.use-case';
import { LogoutUseCase } from './logout.use-case';
import { RefreshTokenUseCase } from './refresh-token.use-case';

const makeUser = async (overrides: Partial<User> = {}): Promise<User> => ({
  id: 'u1',
  name: 'Admin',
  email: 'admin@test.com',
  passwordHash: await argon2.hash('Senha@123', { type: argon2.argon2id }),
  role: 'ADMIN',
  active: true,
  phone: null,
  avatarPath: null,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const tokenService = {
  issueAccessToken: jest.fn().mockResolvedValue('access-token'),
  generateRefreshToken: jest.fn().mockReturnValue({
    token: 'refresh-raw',
    expiresAt: new Date(Date.now() + 86_400_000),
  }),
  hashRefreshToken: jest.fn((t: string) => `hash:${t}`),
} as unknown as TokenService;

const makeRefreshRepo = (
  overrides: Partial<RefreshTokenRepository> = {},
): RefreshTokenRepository => ({
  create: jest.fn().mockResolvedValue({}),
  findByHash: jest.fn().mockResolvedValue(null),
  revoke: jest.fn().mockResolvedValue(undefined),
  revokeAllForUser: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const audit = {
  log: jest.fn().mockResolvedValue(undefined),
} as unknown as AuditService;

describe('LoginUseCase', () => {
  it('autentica com credenciais corretas', async () => {
    const user = await makeUser();
    const userRepo = {
      findByEmail: jest.fn().mockResolvedValue(user),
    } as unknown as UserRepository;
    const refreshRepo = makeRefreshRepo();
    const useCase = new LoginUseCase(userRepo, refreshRepo, tokenService, audit);

    const result = await useCase.execute({
      email: user.email,
      password: 'Senha@123',
    });

    expect(result.accessToken).toBe('access-token');
    expect(refreshRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: 'hash:refresh-raw' }),
    );
  });

  it('rejeita senha incorreta', async () => {
    const user = await makeUser();
    const userRepo = {
      findByEmail: jest.fn().mockResolvedValue(user),
    } as unknown as UserRepository;
    const useCase = new LoginUseCase(userRepo, makeRefreshRepo(), tokenService, audit);
    await expect(
      useCase.execute({ email: user.email, password: 'errada-123' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('rejeita usuário inativo', async () => {
    const user = await makeUser({ active: false });
    const userRepo = {
      findByEmail: jest.fn().mockResolvedValue(user),
    } as unknown as UserRepository;
    const useCase = new LoginUseCase(userRepo, makeRefreshRepo(), tokenService, audit);
    await expect(
      useCase.execute({ email: user.email, password: 'Senha@123' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('rejeita e-mail desconhecido', async () => {
    const userRepo = {
      findByEmail: jest.fn().mockResolvedValue(null),
    } as unknown as UserRepository;
    const useCase = new LoginUseCase(userRepo, makeRefreshRepo(), tokenService, audit);
    await expect(
      useCase.execute({ email: 'x@x.com', password: 'Senha@123' }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('RefreshTokenUseCase', () => {
  const stored = {
    id: 'rt1',
    userId: 'u1',
    tokenHash: 'hash:refresh-raw',
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
    createdAt: new Date(),
  };

  it('rotaciona o refresh token válido', async () => {
    const user = await makeUser();
    const userRepo = {
      findById: jest.fn().mockResolvedValue(user),
    } as unknown as UserRepository;
    const refreshRepo = makeRefreshRepo({
      findByHash: jest.fn().mockResolvedValue(stored),
    });
    const useCase = new RefreshTokenUseCase(
      userRepo,
      refreshRepo,
      tokenService,
    );

    const result = await useCase.execute('refresh-raw');

    expect(refreshRepo.revoke).toHaveBeenCalledWith('rt1');
    expect(refreshRepo.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('access-token');
  });

  it('reuso de token revogado derruba todas as sessões', async () => {
    const userRepo = { findById: jest.fn() } as unknown as UserRepository;
    const refreshRepo = makeRefreshRepo({
      findByHash: jest
        .fn()
        .mockResolvedValue({ ...stored, revokedAt: new Date() }),
    });
    const useCase = new RefreshTokenUseCase(
      userRepo,
      refreshRepo,
      tokenService,
    );

    await expect(useCase.execute('refresh-raw')).rejects.toThrow(
      UnauthorizedError,
    );
    expect(refreshRepo.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('rejeita token expirado', async () => {
    const userRepo = { findById: jest.fn() } as unknown as UserRepository;
    const refreshRepo = makeRefreshRepo({
      findByHash: jest.fn().mockResolvedValue({
        ...stored,
        expiresAt: new Date(Date.now() - 1000),
      }),
    });
    const useCase = new RefreshTokenUseCase(
      userRepo,
      refreshRepo,
      tokenService,
    );
    await expect(useCase.execute('refresh-raw')).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('rejeita token desconhecido', async () => {
    const useCase = new RefreshTokenUseCase(
      { findById: jest.fn() } as unknown as UserRepository,
      makeRefreshRepo(),
      tokenService,
    );
    await expect(useCase.execute('nao-existe')).rejects.toThrow(
      UnauthorizedError,
    );
  });
});

describe('LogoutUseCase', () => {
  it('revoga o token ativo', async () => {
    const stored = {
      id: 'rt1',
      userId: 'u1',
      tokenHash: 'hash:refresh-raw',
      expiresAt: new Date(),
      revokedAt: null,
      createdAt: new Date(),
    };
    const refreshRepo = makeRefreshRepo({
      findByHash: jest.fn().mockResolvedValue(stored),
    });
    const useCase = new LogoutUseCase(refreshRepo, tokenService, audit);
    await useCase.execute('refresh-raw');
    expect(refreshRepo.revoke).toHaveBeenCalledWith('rt1');
  });

  it('ignora logout sem cookie', async () => {
    const refreshRepo = makeRefreshRepo();
    const useCase = new LogoutUseCase(refreshRepo, tokenService, audit);
    await useCase.execute(undefined);
    expect(refreshRepo.findByHash).not.toHaveBeenCalled();
  });
});
