import { Event } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { ChaletRepository } from '../../../chalets/domain/chalet.repository';
import { EventRepository } from '../../../events/domain/event.repository';
import { AutoSettlementService } from '../../../settlement/application/auto-settlement.service';
import { FileStorage } from '../../domain/file-storage';
import {
  PurchaseDetail,
  PurchaseRepository,
} from '../../domain/purchase.repository';
import {
  AttachReceiptUseCase,
  CreatePurchaseUseCase,
  DeletePurchaseUseCase,
  PurchaseChaletGate,
  PurchaseEventGate,
} from './manage-purchase.use-cases';

const purchase = {
  id: 'p1',
  eventId: 'e1',
  date: new Date('2030-01-04'),
  description: 'Mercado',
  category: 'GROCERY',
  amountCents: 1000,
  responsibleId: 'u1',
  receiptPath: null,
  responsible: { id: 'u1', name: 'User' },
  chalet: null,
} as unknown as PurchaseDetail;

const makePurchaseRepo = (
  overrides: Partial<PurchaseRepository> = {},
): PurchaseRepository => ({
  findById: jest.fn().mockResolvedValue(purchase),
  create: jest.fn().mockResolvedValue(purchase),
  update: jest.fn().mockResolvedValue({ ...purchase, receiptPath: 'x.pdf' }),
  delete: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([purchase]),
  advancesByEvent: jest.fn().mockResolvedValue([]),
  ...overrides,
});

const makeGate = (
  status: 'OPEN' | 'CLOSED' | null = 'OPEN',
): PurchaseEventGate =>
  new PurchaseEventGate({
    findById: jest
      .fn()
      .mockResolvedValue(status ? ({ id: 'e1', status } as Event) : null),
  } as unknown as EventRepository);

const makeChaletGate = (
  exists = true,
  ownChalets: Array<{ id: string }> = [{ id: 'c1' }],
): PurchaseChaletGate =>
  new PurchaseChaletGate({
    findById: jest.fn().mockResolvedValue(exists ? { id: 'c1' } : null),
    findByOwner: jest.fn().mockResolvedValue(ownChalets),
  } as unknown as ChaletRepository);

const admin: AuthenticatedUser = {
  id: 'admin',
  email: 'a@a',
  name: 'A',
  role: 'ADMIN',
};
const owner: AuthenticatedUser = {
  id: 'owner',
  email: 'o@o',
  name: 'O',
  role: 'OWNER',
};

const storage: FileStorage = {
  save: jest.fn().mockResolvedValue({ path: 'novo.pdf' }),
  resolve: jest.fn((p: string) => `/uploads/${p}`),
  delete: jest.fn().mockResolvedValue(undefined),
};

const autoSettlement = {
  onPurchaseChange: jest.fn().mockResolvedValue(undefined),
} as unknown as AutoSettlementService;

const input = {
  eventId: 'e1',
  date: new Date('2030-01-04'),
  description: 'Mercado',
  category: 'GROCERY' as const,
  amountCents: 1000,
  responsibleId: 'u1',
};

describe('CreatePurchaseUseCase', () => {
  it('cria compra em evento aberto', async () => {
    const repo = makePurchaseRepo();
    const useCase = new CreatePurchaseUseCase(
      repo,
      makeGate('OPEN'),
      makeChaletGate(),
      autoSettlement,
    );
    await useCase.execute(input, admin);
    expect(repo.create).toHaveBeenCalled();
  });

  it('cria adiantamento vinculado a chalé existente', async () => {
    const repo = makePurchaseRepo();
    const useCase = new CreatePurchaseUseCase(
      repo,
      makeGate('OPEN'),
      makeChaletGate(true),
      autoSettlement,
    );
    await useCase.execute({ ...input, chaletId: 'c1' }, admin);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ chaletId: 'c1' }),
    );
  });

  it('falha se chalé do adiantamento não existe', async () => {
    const useCase = new CreatePurchaseUseCase(
      makePurchaseRepo(),
      makeGate('OPEN'),
      makeChaletGate(false),
      autoSettlement,
    );
    await expect(
      useCase.execute({ ...input, chaletId: 'x' }, admin),
    ).rejects.toThrow(NotFoundError);
  });

  it('proprietário: compra é vinculada automaticamente ao seu chalé', async () => {
    const repo = makePurchaseRepo();
    const useCase = new CreatePurchaseUseCase(
      repo,
      makeGate('OPEN'),
      makeChaletGate(),
      autoSettlement,
    );
    await useCase.execute(input, owner);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ chaletId: 'c1' }),
    );
  });

  it('proprietário não lança para chalé de terceiro', async () => {
    const useCase = new CreatePurchaseUseCase(
      makePurchaseRepo(),
      makeGate('OPEN'),
      makeChaletGate(),
      autoSettlement,
    );
    await expect(
      useCase.execute({ ...input, chaletId: 'outro' }, owner),
    ).rejects.toThrow(ForbiddenError);
  });

  it('proprietário sem chalé vinculado é bloqueado', async () => {
    const useCase = new CreatePurchaseUseCase(
      makePurchaseRepo(),
      makeGate('OPEN'),
      makeChaletGate(true, []),
      autoSettlement,
    );
    await expect(useCase.execute(input, owner)).rejects.toThrow(ForbiddenError);
  });

  it('bloqueia compra em evento encerrado', async () => {
    const useCase = new CreatePurchaseUseCase(
      makePurchaseRepo(),
      makeGate('CLOSED'),
      makeChaletGate(),
      autoSettlement,
    );
    await expect(useCase.execute(input, admin)).rejects.toThrow(ConflictError);
  });

  it('falha se evento não existe', async () => {
    const useCase = new CreatePurchaseUseCase(
      makePurchaseRepo(),
      makeGate(null),
      makeChaletGate(),
      autoSettlement,
    );
    await expect(useCase.execute(input, admin)).rejects.toThrow(NotFoundError);
  });
});

describe('DeletePurchaseUseCase', () => {
  it('remove compra e comprovante', async () => {
    const repo = makePurchaseRepo({
      findById: jest
        .fn()
        .mockResolvedValue({ ...purchase, receiptPath: 'r.pdf' }),
    });
    const useCase = new DeletePurchaseUseCase(
      repo,
      makeGate('OPEN'),
      storage,
      makeChaletGate(),
      autoSettlement,
    );
    await useCase.execute('p1', admin);
    expect(storage.delete).toHaveBeenCalledWith('r.pdf');
    expect(repo.delete).toHaveBeenCalledWith('p1');
  });

  it('falha para compra inexistente', async () => {
    const repo = makePurchaseRepo({
      findById: jest.fn().mockResolvedValue(null),
    });
    const useCase = new DeletePurchaseUseCase(
      repo,
      makeGate('OPEN'),
      storage,
      makeChaletGate(),
      autoSettlement,
    );
    await expect(useCase.execute('x', admin)).rejects.toThrow(NotFoundError);
  });
});

describe('AttachReceiptUseCase', () => {
  it('salva arquivo e vincula à compra', async () => {
    const repo = makePurchaseRepo();
    const useCase = new AttachReceiptUseCase(
      repo,
      makeGate('OPEN'),
      storage,
      makeChaletGate(),
    );
    const result = await useCase.execute(
      'p1',
      Buffer.from('pdf'),
      'nota.pdf',
      admin,
    );
    expect(storage.save).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith('p1', { receiptPath: 'novo.pdf' });
    expect(result.hasReceipt).toBe(true);
  });

  it('bloqueia anexo com evento encerrado', async () => {
    const useCase = new AttachReceiptUseCase(
      makePurchaseRepo(),
      makeGate('CLOSED'),
      storage,
      makeChaletGate(),
    );
    await expect(
      useCase.execute('p1', Buffer.from('x'), 'n.pdf', admin),
    ).rejects.toThrow(ConflictError);
  });
});
