import { ChaletStatus } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { UserRepository } from '../../../users/domain/user.repository';
import {
  ChaletRepository,
  ChaletWithOwner,
} from '../../domain/chalet.repository';
import { ChaletOccupancyQuery } from '../../infrastructure/chalet-occupancy.query';
import {
  AddChaletMemberUseCase,
  CreateChaletUseCase,
  DeleteChaletUseCase,
  ListChaletMembersUseCase,
  ListChaletsUseCase,
  RemoveChaletMemberUseCase,
  UpdateChaletUseCase,
} from './manage-chalet.use-cases';

const admin: AuthenticatedUser = {
  id: 'admin',
  email: 'a@a',
  name: 'Admin',
  role: 'ADMIN',
};
const owner: AuthenticatedUser = {
  id: 'owner',
  email: 'o@o',
  name: 'Owner',
  role: 'OWNER',
};

const chalet = {
  id: 'c1',
  number: 1,
  name: 'Chalé 01',
  ownerId: 'owner',
  status: 'FREE',
  createdAt: new Date(),
  updatedAt: new Date(),
  owner: null,
} as ChaletWithOwner;

const makeChaletRepo = (
  overrides: Partial<ChaletRepository> = {},
): ChaletRepository => ({
  findById: jest.fn().mockResolvedValue(chalet),
  findByNumber: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(chalet),
  update: jest.fn().mockResolvedValue(chalet),
  list: jest.fn().mockResolvedValue([chalet]),
  findByOwner: jest.fn().mockResolvedValue([]),
  findAccessibleByUser: jest.fn().mockResolvedValue([chalet]),
  isOwnerOrMember: jest.fn().mockResolvedValue(false),
  isMemberOfAnyChalet: jest.fn().mockResolvedValue(false),
  listMembers: jest.fn().mockResolvedValue([]),
  addMember: jest.fn().mockResolvedValue(undefined),
  removeMember: jest.fn().mockResolvedValue(undefined),
  countMembers: jest.fn().mockResolvedValue(0),
  hasHistory: jest.fn().mockResolvedValue(false),
  delete: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

/** Ocupação é derivada das reservas; aqui basta o mapa pronto. */
const makeOccupancy = (
  statuses: Map<string, ChaletStatus> = new Map(),
): ChaletOccupancyQuery =>
  ({
    currentStatuses: jest.fn().mockResolvedValue(statuses),
  }) as unknown as ChaletOccupancyQuery;

const makeUserRepo = (found = true): UserRepository =>
  ({
    findById: jest
      .fn()
      .mockResolvedValue(found ? { id: 'u1', name: 'Dono' } : null),
  }) as unknown as UserRepository;

describe('CreateChaletUseCase', () => {
  it('cria chalé com número único', async () => {
    const repo = makeChaletRepo();
    const useCase = new CreateChaletUseCase(repo, makeUserRepo());
    await useCase.execute({ number: 12, name: 'Chalé 12' });
    expect(repo.create).toHaveBeenCalled();
  });

  it('bloqueia número duplicado', async () => {
    const repo = makeChaletRepo({
      findByNumber: jest.fn().mockResolvedValue(chalet),
    });
    const useCase = new CreateChaletUseCase(repo, makeUserRepo());
    await expect(useCase.execute({ number: 1, name: 'Dup' })).rejects.toThrow(
      ConflictError,
    );
  });

  it('valida existência do proprietário', async () => {
    const useCase = new CreateChaletUseCase(
      makeChaletRepo(),
      makeUserRepo(false),
    );
    await expect(
      useCase.execute({ number: 12, name: 'X', ownerId: 'nao-existe' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('UpdateChaletUseCase', () => {
  it('admin atualiza qualquer chalé, inclusive proprietário', async () => {
    const repo = makeChaletRepo();
    const useCase = new UpdateChaletUseCase(
      repo,
      makeUserRepo(),
      makeOccupancy(),
    );
    await useCase.execute({ id: 'c1', name: 'Novo nome', ownerId: 'u1' }, admin);
    expect(repo.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ name: 'Novo nome', ownerId: 'u1' }),
    );
  });

  it('status não é gravado: ninguém edita ocupação à mão', async () => {
    const repo = makeChaletRepo();
    const useCase = new UpdateChaletUseCase(
      repo,
      makeUserRepo(),
      makeOccupancy(),
    );
    await useCase.execute({ id: 'c1', name: 'Meu Chalé' }, admin);
    expect(repo.update).toHaveBeenCalledWith(
      'c1',
      expect.not.objectContaining({ status: expect.anything() }),
    );
  });

  it('resposta traz o status derivado das reservas, não o do banco', async () => {
    const repo = makeChaletRepo();
    const useCase = new UpdateChaletUseCase(
      repo,
      makeUserRepo(),
      // chalet mockado está como FREE no banco; a reserva de hoje manda
      makeOccupancy(new Map([['c1', ChaletStatus.OCCUPIED]])),
    );
    const response = await useCase.execute({ id: 'c1', name: 'X' }, admin);
    expect(response.status).toBe('OCCUPIED');
  });

  it('virar proprietário desfaz o vínculo de familiar no mesmo chalé', async () => {
    const repo = makeChaletRepo();
    const useCase = new UpdateChaletUseCase(repo, makeUserRepo(), makeOccupancy());
    await useCase.execute({ id: 'c1', ownerId: 'u1' }, admin);
    expect(repo.removeMember).toHaveBeenCalledWith('c1', 'u1');
  });

  it('não torna proprietário quem já é familiar de outro chalé', async () => {
    const repo = makeChaletRepo({
      findAccessibleByUser: jest
        .fn()
        .mockResolvedValue([{ ...chalet, id: 'c2', number: 2, ownerId: 'x' }]),
    });
    const useCase = new UpdateChaletUseCase(repo, makeUserRepo(), makeOccupancy());
    await expect(
      useCase.execute({ id: 'c1', ownerId: 'u1' }, admin),
    ).rejects.toThrow(ConflictError);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.removeMember).not.toHaveBeenCalled();
  });

  it('editar sem trocar o dono não mexe nos familiares', async () => {
    const repo = makeChaletRepo();
    const useCase = new UpdateChaletUseCase(repo, makeUserRepo(), makeOccupancy());
    await useCase.execute({ id: 'c1', name: 'Só o nome' }, admin);
    expect(repo.removeMember).not.toHaveBeenCalled();
  });

  it('proprietário edita o nome do próprio chalé', async () => {
    const repo = makeChaletRepo();
    const useCase = new UpdateChaletUseCase(repo, makeUserRepo(), makeOccupancy());
    await useCase.execute({ id: 'c1', name: 'Meu Chalé' }, owner);
    expect(repo.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ name: 'Meu Chalé' }),
    );
  });

  it('proprietário não edita chalé alheio', async () => {
    const repo = makeChaletRepo({
      findById: jest.fn().mockResolvedValue({ ...chalet, ownerId: 'outro' }),
    });
    const useCase = new UpdateChaletUseCase(repo, makeUserRepo(), makeOccupancy());
    await expect(
      useCase.execute({ id: 'c1', name: 'X' }, owner),
    ).rejects.toThrow(ForbiddenError);
  });

  it('proprietário não transfere a propriedade', async () => {
    const useCase = new UpdateChaletUseCase(makeChaletRepo(), makeUserRepo(), makeOccupancy());
    await expect(
      useCase.execute({ id: 'c1', ownerId: 'outro' }, owner),
    ).rejects.toThrow(ForbiddenError);
  });

  it('falha para chalé inexistente', async () => {
    const repo = makeChaletRepo({
      findById: jest.fn().mockResolvedValue(null),
    });
    const useCase = new UpdateChaletUseCase(repo, makeUserRepo(), makeOccupancy());
    await expect(
      useCase.execute({ id: 'x', name: 'Y' }, admin),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('DeleteChaletUseCase', () => {
  it('exclui chalé sem histórico', async () => {
    const repo = makeChaletRepo();
    const useCase = new DeleteChaletUseCase(repo);
    await useCase.execute('c1');
    expect(repo.delete).toHaveBeenCalledWith('c1');
  });

  it('bloqueia exclusão com histórico (reservas/rateios/pagamentos)', async () => {
    const repo = makeChaletRepo({
      hasHistory: jest.fn().mockResolvedValue(true),
    });
    const useCase = new DeleteChaletUseCase(repo);
    await expect(useCase.execute('c1')).rejects.toThrow(ConflictError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('falha para chalé inexistente', async () => {
    const repo = makeChaletRepo({
      findById: jest.fn().mockResolvedValue(null),
    });
    const useCase = new DeleteChaletUseCase(repo);
    await expect(useCase.execute('x')).rejects.toThrow(NotFoundError);
  });
});

describe('ListChaletsUseCase', () => {
  it('marca como livre o chalé sem reserva em aberto', async () => {
    const useCase = new ListChaletsUseCase(makeChaletRepo(), makeOccupancy());
    const result = await useCase.execute();
    expect(result[0].status).toBe('FREE');
  });

  it('marca como ocupado o chalé com estadia em andamento', async () => {
    const useCase = new ListChaletsUseCase(
      makeChaletRepo(),
      makeOccupancy(new Map([['c1', ChaletStatus.OCCUPIED]])),
    );
    const result = await useCase.execute();
    expect(result[0].status).toBe('OCCUPIED');
  });

  it('lista chalés mapeados', async () => {
    const useCase = new ListChaletsUseCase(makeChaletRepo(), makeOccupancy());
    const result = await useCase.execute();
    expect(result[0]).toMatchObject({ number: 1, owner: null });
  });
});

describe('ChaletMembersUseCases', () => {
  it('dono ou admin pode listar membros', async () => {
    const repo = makeChaletRepo({
      isOwnerOrMember: jest.fn().mockResolvedValue(true),
      listMembers: jest
        .fn()
        .mockResolvedValue([{ id: 'u2', name: 'Familiar' }]),
    });
    const useCase = new ListChaletMembersUseCase(repo);
    const members = await useCase.execute('c1', owner);
    expect(members).toHaveLength(1);
  });

  it('adiciona familiar respeitando limite de 4 familiares', async () => {
    const repo = makeChaletRepo({
      countMembers: jest.fn().mockResolvedValue(4),
    });
    const useCase = new AddChaletMemberUseCase(repo, makeUserRepo());
    await expect(
      useCase.execute(
        { chaletId: 'c1', name: 'Fam', email: 'f@f.com', password: 'pass' },
        owner,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('dono pode remover familiar', async () => {
    const repo = makeChaletRepo();
    const useCase = new RemoveChaletMemberUseCase(repo);
    await useCase.execute('c1', 'u2', owner);
    expect(repo.removeMember).toHaveBeenCalledWith('c1', 'u2');
  });
});
