import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { UserRepository } from '../../domain/user.repository';
import { CreateUserUseCase } from './create-user.use-case';
import { DeleteUserUseCase } from './delete-user.use-case';
import { ListUsersUseCase } from './list-users.use-case';
import { UpdateUserUseCase } from './update-user.use-case';

const user = {
  id: 'u1',
  name: 'Fulano',
  email: 'fulano@test.com',
  passwordHash: 'hash',
  role: 'OWNER',
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as User;

const makeRepo = (overrides: Partial<UserRepository> = {}): UserRepository => ({
  findById: jest.fn().mockResolvedValue(user),
  findByEmail: jest.fn().mockResolvedValue(null),
  create: jest
    .fn()
    .mockImplementation((data) => Promise.resolve({ ...user, ...data })),
  update: jest
    .fn()
    .mockImplementation((_id, data) => Promise.resolve({ ...user, ...data })),
  list: jest.fn().mockResolvedValue([user]),
  hasHistory: jest.fn().mockResolvedValue(false),
  delete: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('CreateUserUseCase', () => {
  it('cria usuário com senha em Argon2 e sem expor o hash', async () => {
    const repo = makeRepo();
    const useCase = new CreateUserUseCase(repo);

    const result = await useCase.execute({
      name: 'Novo',
      email: 'novo@test.com',
      password: 'Senha@123',
      role: 'OWNER',
    });

    const created = (repo.create as jest.Mock).mock.calls[0][0];
    await expect(
      argon2.verify(created.passwordHash, 'Senha@123'),
    ).resolves.toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('bloqueia e-mail duplicado', async () => {
    const repo = makeRepo({ findByEmail: jest.fn().mockResolvedValue(user) });
    const useCase = new CreateUserUseCase(repo);
    await expect(
      useCase.execute({
        name: 'X',
        email: user.email,
        password: 'Senha@123',
        role: 'OWNER',
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('UpdateUserUseCase', () => {
  it('atualiza dados do usuário', async () => {
    const repo = makeRepo();
    const useCase = new UpdateUserUseCase(repo);
    const result = await useCase.execute({ id: 'u1', active: false });
    expect(result.active).toBe(false);
  });

  it('falha para usuário inexistente', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const useCase = new UpdateUserUseCase(repo);
    await expect(useCase.execute({ id: 'x', name: 'Y' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('bloqueia troca para e-mail já usado', async () => {
    const repo = makeRepo({
      findByEmail: jest.fn().mockResolvedValue({ ...user, id: 'outro' }),
    });
    const useCase = new UpdateUserUseCase(repo);
    await expect(
      useCase.execute({ id: 'u1', email: 'em-uso@test.com' }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('DeleteUserUseCase', () => {
  it('exclui usuário sem vínculos', async () => {
    const repo = makeRepo();
    const useCase = new DeleteUserUseCase(repo);
    await useCase.execute({ id: 'u1', currentUserId: 'admin' });
    expect(repo.delete).toHaveBeenCalledWith('u1');
  });

  it('bloqueia exclusão do próprio usuário', async () => {
    const repo = makeRepo();
    const useCase = new DeleteUserUseCase(repo);
    await expect(
      useCase.execute({ id: 'u1', currentUserId: 'u1' }),
    ).rejects.toThrow(ForbiddenError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('falha para usuário inexistente', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const useCase = new DeleteUserUseCase(repo);
    await expect(
      useCase.execute({ id: 'x', currentUserId: 'admin' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('bloqueia exclusão de usuário com vínculos', async () => {
    const repo = makeRepo({ hasHistory: jest.fn().mockResolvedValue(true) });
    const useCase = new DeleteUserUseCase(repo);
    await expect(
      useCase.execute({ id: 'u1', currentUserId: 'admin' }),
    ).rejects.toThrow(ConflictError);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});

describe('ListUsersUseCase', () => {
  it('lista usuários sem hash de senha', async () => {
    const useCase = new ListUsersUseCase(makeRepo());
    const result = await useCase.execute();
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('passwordHash');
  });
});
