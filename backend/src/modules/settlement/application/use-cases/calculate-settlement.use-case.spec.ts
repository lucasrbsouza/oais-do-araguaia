import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import {
  SettlementRepository,
  SettlementView,
} from '../../domain/settlement.repository';
import { WeightedExpenseSharingStrategy } from '../../domain/weighted-expense-sharing.strategy';
import { CalculateSettlementUseCase } from './calculate-settlement.use-case';
import { GetSettlementUseCase } from './get-settlement.use-case';

const view: SettlementView = {
  eventId: 'e1',
  strategy: 'weighted-common+alcohol-consumers',
  computedAt: new Date(),
  commonTotalCents: 1000,
  alcoholTotalCents: 0,
  totalCents: 1000,
  items: [],
};

const makeRepo = (
  overrides: Partial<SettlementRepository> = {},
): SettlementRepository => ({
  getCalculationInput: jest.fn().mockResolvedValue({
    eventId: 'e1',
    eventStatus: 'OPEN',
    stays: [
      { chaletId: 'c1', adults: 2, children: 0, alcoholConsumers: 0, nights: 1 },
    ],
    commonTotalCents: 1000,
    alcoholTotalCents: 0,
  }),
  save: jest.fn().mockResolvedValue(undefined),
  getAutoConfig: jest
    .fn()
    .mockResolvedValue({ mode: 'MANUAL', intervalMinutes: null }),
  setAutoConfig: jest
    .fn()
    .mockResolvedValue({ mode: 'MANUAL', intervalMinutes: null }),
  findByEvent: jest.fn().mockResolvedValue(view),
  ...overrides,
});

describe('CalculateSettlementUseCase', () => {
  const strategy = new WeightedExpenseSharingStrategy();

  it('calcula, persiste e retorna o rateio', async () => {
    const repo = makeRepo();
    const useCase = new CalculateSettlementUseCase(repo, strategy);

    const result = await useCase.execute('e1', 'admin');

    expect(repo.save).toHaveBeenCalledWith(
      'e1',
      strategy.name,
      [
        {
          chaletId: 'c1',
          commonCents: 1000,
          alcoholCents: 0,
          totalCents: 1000,
        },
      ],
      'admin',
    );
    expect(result).toBe(view);
  });

  it('falha se o evento não existe', async () => {
    const repo = makeRepo({
      getCalculationInput: jest.fn().mockResolvedValue(null),
    });
    const useCase = new CalculateSettlementUseCase(repo, strategy);
    await expect(useCase.execute('x', 'admin')).rejects.toThrow(NotFoundError);
  });

  it('bloqueia recálculo de evento encerrado', async () => {
    const repo = makeRepo({
      getCalculationInput: jest.fn().mockResolvedValue({
        eventId: 'e1',
        eventStatus: 'CLOSED',
        stays: [],
        commonTotalCents: 0,
        alcoholTotalCents: 0,
      }),
    });
    const useCase = new CalculateSettlementUseCase(repo, strategy);
    await expect(useCase.execute('e1', 'admin')).rejects.toThrow(ConflictError);
  });
});

describe('GetSettlementUseCase', () => {
  it('retorna o rateio existente', async () => {
    const useCase = new GetSettlementUseCase(makeRepo());
    await expect(useCase.execute('e1')).resolves.toBe(view);
  });

  it('falha se ainda não calculado', async () => {
    const useCase = new GetSettlementUseCase(
      makeRepo({ findByEvent: jest.fn().mockResolvedValue(null) }),
    );
    await expect(useCase.execute('e1')).rejects.toThrow(NotFoundError);
  });
});
