import { Payment } from '@prisma/client';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { ChaletRepository } from '../../../chalets/domain/chalet.repository';
import { EventRepository } from '../../../events/domain/event.repository';
import {
  SettlementRepository,
  SettlementView,
} from '../../../settlement/domain/settlement.repository';
import { PurchaseRepository } from '../../../purchases/domain/purchase.repository';
import { PaymentRepository } from '../../domain/payment.repository';
import {
  GetEventPaymentsUseCase,
  RegisterPaymentUseCase,
} from './manage-payment.use-cases';

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

const settlement: SettlementView = {
  eventId: 'e1',
  strategy: 's',
  computedAt: new Date(),
  commonTotalCents: 3000,
  alcoholTotalCents: 0,
  totalCents: 3000,
  items: [
    {
      chaletId: 'c1',
      chaletNumber: 1,
      chaletName: 'A',
      commonCents: 2000,
      alcoholCents: 0,
      totalCents: 2000,
    },
    {
      chaletId: 'c2',
      chaletNumber: 2,
      chaletName: 'B',
      commonCents: 1000,
      alcoholCents: 0,
      totalCents: 1000,
    },
  ],
};

const payments = [
  {
    id: 'p1',
    eventId: 'e1',
    chaletId: 'c1',
    date: new Date(),
    amountCents: 500,
    notes: null,
  },
] as Payment[];

const paymentRepo = {
  create: jest.fn().mockResolvedValue(payments[0]),
  listByEvent: jest.fn().mockResolvedValue(payments),
  listByEventAndChalet: jest.fn(),
} as unknown as PaymentRepository;

const settlementRepo = {
  findByEvent: jest.fn().mockResolvedValue(settlement),
} as unknown as SettlementRepository;

const purchaseRepo = {
  advancesByEvent: jest.fn().mockResolvedValue([]),
} as unknown as PurchaseRepository;

const purchaseRepoWithAdvances = {
  advancesByEvent: jest
    .fn()
    .mockResolvedValue([{ chaletId: 'c2', totalCents: 1500 }]),
} as unknown as PurchaseRepository;

const chaletRepo = {
  findById: jest.fn().mockResolvedValue({ id: 'c1' }),
  findByOwner: jest.fn().mockResolvedValue([{ id: 'c1' }]),
} as unknown as ChaletRepository;

const eventRepo = {
  findById: jest.fn().mockResolvedValue({ id: 'e1' }),
} as unknown as EventRepository;

describe('RegisterPaymentUseCase', () => {
  it('registra pagamento', async () => {
    const useCase = new RegisterPaymentUseCase(
      paymentRepo,
      eventRepo,
      chaletRepo,
    );
    await useCase.execute(
      { eventId: 'e1', chaletId: 'c1', date: new Date(), amountCents: 500 },
      'admin',
    );
    expect(paymentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ registeredById: 'admin' }),
    );
  });

  it('falha para evento inexistente', async () => {
    const useCase = new RegisterPaymentUseCase(
      paymentRepo,
      {
        findById: jest.fn().mockResolvedValue(null),
      } as unknown as EventRepository,
      chaletRepo,
    );
    await expect(
      useCase.execute(
        { eventId: 'x', chaletId: 'c1', date: new Date(), amountCents: 1 },
        'a',
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('GetEventPaymentsUseCase', () => {
  it('admin vê todos os chalés com status derivado', async () => {
    const useCase = new GetEventPaymentsUseCase(
      paymentRepo,
      purchaseRepo,
      settlementRepo,
      chaletRepo,
    );
    const result = await useCase.execute('e1', admin);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      chaletId: 'c1',
      paidCents: 500,
      advanceCents: 0,
      balanceCents: 1500,
      status: 'PARTIAL',
    });
    expect(result[1]).toMatchObject({
      chaletId: 'c2',
      paidCents: 0,
      status: 'PENDING',
    });
  });

  it('adiantamentos abatem o saldo e compõem o status', async () => {
    const useCase = new GetEventPaymentsUseCase(
      paymentRepo,
      purchaseRepoWithAdvances,
      settlementRepo,
      chaletRepo,
    );
    const result = await useCase.execute('e1', admin);
    // c2 deve 1000, adiantou 1500 → quitado com crédito de 500.
    expect(result[1]).toMatchObject({
      chaletId: 'c2',
      advanceCents: 1500,
      balanceCents: -500,
      status: 'PAID',
    });
  });

  it('proprietário vê apenas o próprio chalé', async () => {
    const useCase = new GetEventPaymentsUseCase(
      paymentRepo,
      purchaseRepo,
      settlementRepo,
      chaletRepo,
    );
    const result = await useCase.execute('e1', owner);
    expect(result).toHaveLength(1);
    expect(result[0].chaletId).toBe('c1');
  });

  it('proprietário sem chalé no rateio é bloqueado', async () => {
    const useCase = new GetEventPaymentsUseCase(
      paymentRepo,
      purchaseRepo,
      settlementRepo,
      {
        ...chaletRepo,
        findByOwner: jest.fn().mockResolvedValue([]),
      } as unknown as ChaletRepository,
    );
    await expect(useCase.execute('e1', owner)).rejects.toThrow(ForbiddenError);
  });

  it('falha sem rateio calculado', async () => {
    const useCase = new GetEventPaymentsUseCase(
      paymentRepo,
      purchaseRepo,
      {
        findByEvent: jest.fn().mockResolvedValue(null),
      } as unknown as SettlementRepository,
      chaletRepo,
    );
    await expect(useCase.execute('e1', admin)).rejects.toThrow(NotFoundError);
  });
});
