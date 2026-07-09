import { Event } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/domain-error';
import { AuditService } from '../../../audit/audit.service';
import { SettlementRepository } from '../../../settlement/domain/settlement.repository';
import { WeightedExpenseSharingStrategy } from '../../../settlement/domain/weighted-expense-sharing.strategy';
import { EventRepository } from '../../domain/event.repository';
import {
  CloseEventUseCase,
  CreateEventUseCase,
  GetEventUseCase,
  ReopenEventUseCase,
} from './manage-event.use-cases';

const openEvent = {
  id: 'e1',
  name: 'FDS',
  startDate: new Date('2030-01-04'),
  endDate: new Date('2030-01-06'),
  status: 'OPEN',
  closedAt: null,
  closedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Event;

const closedEvent = { ...openEvent, status: 'CLOSED' } as Event;

const makeEventRepo = (
  overrides: Partial<EventRepository> = {},
): EventRepository => ({
  findById: jest.fn().mockResolvedValue(openEvent),
  create: jest.fn().mockResolvedValue(openEvent),
  update: jest.fn(),
  list: jest.fn(),
  findOverlapping: jest.fn().mockResolvedValue([]),
  closeWithSettlement: jest.fn().mockResolvedValue(closedEvent),
  reopen: jest.fn().mockResolvedValue(openEvent),
  ...overrides,
});

const makeSettlementRepo = (): SettlementRepository => ({
  getCalculationInput: jest.fn().mockResolvedValue({
    eventId: 'e1',
    eventStatus: 'OPEN',
    occupancies: [
      { chaletId: 'c1', adults: 1, children: 0, alcoholConsumers: 0 },
    ],
    commonTotalCents: 500,
    alcoholTotalCents: 0,
  }),
  save: jest.fn(),
  findByEvent: jest.fn(),
});

const audit = {
  log: jest.fn().mockResolvedValue(undefined),
} as unknown as AuditService;

describe('CreateEventUseCase', () => {
  it('cria evento sem sobreposição', async () => {
    const repo = makeEventRepo();
    const useCase = new CreateEventUseCase(repo);
    await useCase.execute({
      name: 'FDS',
      startDate: new Date('2030-01-04'),
      endDate: new Date('2030-01-06'),
    });
    expect(repo.create).toHaveBeenCalled();
  });

  it('bloqueia sobreposição de eventos', async () => {
    const repo = makeEventRepo({
      findOverlapping: jest.fn().mockResolvedValue([openEvent]),
    });
    const useCase = new CreateEventUseCase(repo);
    await expect(
      useCase.execute({
        name: 'Outro',
        startDate: new Date('2030-01-05'),
        endDate: new Date('2030-01-07'),
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('rejeita intervalo invertido', async () => {
    const useCase = new CreateEventUseCase(makeEventRepo());
    await expect(
      useCase.execute({
        name: 'X',
        startDate: new Date('2030-01-06'),
        endDate: new Date('2030-01-04'),
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('GetEventUseCase', () => {
  it('falha para evento inexistente', async () => {
    const useCase = new GetEventUseCase(
      makeEventRepo({ findById: jest.fn().mockResolvedValue(null) }),
    );
    await expect(useCase.execute('x')).rejects.toThrow(NotFoundError);
  });
});

describe('CloseEventUseCase', () => {
  const strategy = new WeightedExpenseSharingStrategy();

  it('fecha calculando e congelando o rateio, com auditoria', async () => {
    const repo = makeEventRepo();
    const useCase = new CloseEventUseCase(
      repo,
      makeSettlementRepo(),
      strategy,
      audit,
    );

    const result = await useCase.execute('e1', 'admin');

    expect(repo.closeWithSettlement).toHaveBeenCalledWith(
      'e1',
      strategy.name,
      [{ chaletId: 'c1', commonCents: 500, alcoholCents: 0, totalCents: 500 }],
      'admin',
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EVENT_CLOSED' }),
    );
    expect(result.status).toBe('CLOSED');
  });

  it('não fecha evento já encerrado', async () => {
    const repo = makeEventRepo({
      findById: jest.fn().mockResolvedValue(closedEvent),
    });
    const useCase = new CloseEventUseCase(
      repo,
      makeSettlementRepo(),
      strategy,
      audit,
    );
    await expect(useCase.execute('e1', 'admin')).rejects.toThrow(ConflictError);
  });
});

describe('ReopenEventUseCase', () => {
  it('reabre evento encerrado com auditoria', async () => {
    const repo = makeEventRepo({
      findById: jest.fn().mockResolvedValue(closedEvent),
    });
    const useCase = new ReopenEventUseCase(repo, audit);
    await useCase.execute('e1', 'admin');
    expect(repo.reopen).toHaveBeenCalledWith('e1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EVENT_REOPENED' }),
    );
  });

  it('não reabre evento já aberto', async () => {
    const useCase = new ReopenEventUseCase(makeEventRepo(), audit);
    await expect(useCase.execute('e1', 'admin')).rejects.toThrow(ConflictError);
  });
});
