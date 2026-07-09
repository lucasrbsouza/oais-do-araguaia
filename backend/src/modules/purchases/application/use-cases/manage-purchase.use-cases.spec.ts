import { Event } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { EventRepository } from '../../../events/domain/event.repository';
import { FileStorage } from '../../domain/file-storage';
import {
  PurchaseDetail,
  PurchaseRepository,
} from '../../domain/purchase.repository';
import {
  AttachReceiptUseCase,
  CreatePurchaseUseCase,
  DeletePurchaseUseCase,
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
} as unknown as PurchaseDetail;

const makePurchaseRepo = (
  overrides: Partial<PurchaseRepository> = {},
): PurchaseRepository => ({
  findById: jest.fn().mockResolvedValue(purchase),
  create: jest.fn().mockResolvedValue(purchase),
  update: jest.fn().mockResolvedValue({ ...purchase, receiptPath: 'x.pdf' }),
  delete: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([purchase]),
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

const storage: FileStorage = {
  save: jest.fn().mockResolvedValue({ path: 'novo.pdf' }),
  resolve: jest.fn((p: string) => `/uploads/${p}`),
  delete: jest.fn().mockResolvedValue(undefined),
};

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
    const useCase = new CreatePurchaseUseCase(repo, makeGate('OPEN'));
    await useCase.execute(input);
    expect(repo.create).toHaveBeenCalled();
  });

  it('bloqueia compra em evento encerrado', async () => {
    const useCase = new CreatePurchaseUseCase(
      makePurchaseRepo(),
      makeGate('CLOSED'),
    );
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it('falha se evento não existe', async () => {
    const useCase = new CreatePurchaseUseCase(
      makePurchaseRepo(),
      makeGate(null),
    );
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });
});

describe('DeletePurchaseUseCase', () => {
  it('remove compra e comprovante', async () => {
    const repo = makePurchaseRepo({
      findById: jest
        .fn()
        .mockResolvedValue({ ...purchase, receiptPath: 'r.pdf' }),
    });
    const useCase = new DeletePurchaseUseCase(repo, makeGate('OPEN'), storage);
    await useCase.execute('p1');
    expect(storage.delete).toHaveBeenCalledWith('r.pdf');
    expect(repo.delete).toHaveBeenCalledWith('p1');
  });

  it('falha para compra inexistente', async () => {
    const repo = makePurchaseRepo({
      findById: jest.fn().mockResolvedValue(null),
    });
    const useCase = new DeletePurchaseUseCase(repo, makeGate('OPEN'), storage);
    await expect(useCase.execute('x')).rejects.toThrow(NotFoundError);
  });
});

describe('AttachReceiptUseCase', () => {
  it('salva arquivo e vincula à compra', async () => {
    const repo = makePurchaseRepo();
    const useCase = new AttachReceiptUseCase(repo, makeGate('OPEN'), storage);
    const result = await useCase.execute('p1', Buffer.from('pdf'), 'nota.pdf');
    expect(storage.save).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith('p1', { receiptPath: 'novo.pdf' });
    expect(result.hasReceipt).toBe(true);
  });

  it('bloqueia anexo com evento encerrado', async () => {
    const useCase = new AttachReceiptUseCase(
      makePurchaseRepo(),
      makeGate('CLOSED'),
      storage,
    );
    await expect(
      useCase.execute('p1', Buffer.from('x'), 'n.pdf'),
    ).rejects.toThrow(ConflictError);
  });
});
