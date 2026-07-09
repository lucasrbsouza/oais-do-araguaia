import { ValidationError } from '../../../shared/domain/domain-error';
import { Money } from '../../../shared/domain/money';
import { ChaletOccupancy } from './expense-sharing.strategy';
import { WeightedExpenseSharingStrategy } from './weighted-expense-sharing.strategy';

const occupancy = (
  partial: Partial<ChaletOccupancy> & { chaletId: string },
): ChaletOccupancy => ({
  adults: 0,
  children: 0,
  alcoholConsumers: 0,
  ...partial,
});

describe('WeightedExpenseSharingStrategy', () => {
  const strategy = new WeightedExpenseSharingStrategy();

  it('divide despesas comuns por peso: adulto 1.0, criança 0.5', () => {
    const shares = strategy.calculate({
      occupancies: [
        occupancy({ chaletId: 'a', adults: 2 }), // peso 20
        occupancy({ chaletId: 'b', adults: 1, children: 2 }), // peso 20
        occupancy({ chaletId: 'c', adults: 1 }), // peso 10
      ],
      commonTotal: Money.fromCents(50000),
      alcoholTotal: Money.zero(),
    });

    expect(shares.map((s) => s.commonCents)).toEqual([20000, 20000, 10000]);
    expect(shares.every((s) => s.alcoholCents === 0)).toBe(true);
  });

  it('divide álcool apenas entre consumidores marcados', () => {
    const shares = strategy.calculate({
      occupancies: [
        occupancy({ chaletId: 'a', adults: 4, alcoholConsumers: 3 }),
        occupancy({ chaletId: 'b', adults: 2, alcoholConsumers: 0 }),
        occupancy({ chaletId: 'c', adults: 1, alcoholConsumers: 1 }),
      ],
      commonTotal: Money.zero(),
      alcoholTotal: Money.fromCents(20000),
    });

    expect(shares.map((s) => s.alcoholCents)).toEqual([15000, 0, 5000]);
  });

  it('total do chalé = comum + álcool e soma geral fecha', () => {
    const shares = strategy.calculate({
      occupancies: [
        occupancy({
          chaletId: 'a',
          adults: 3,
          children: 1,
          alcoholConsumers: 2,
        }),
        occupancy({
          chaletId: 'b',
          adults: 2,
          children: 3,
          alcoholConsumers: 1,
        }),
        occupancy({ chaletId: 'c', adults: 5, alcoholConsumers: 0 }),
      ],
      commonTotal: Money.fromCents(123457),
      alcoholTotal: Money.fromCents(9999),
    });

    for (const share of shares) {
      expect(share.totalCents).toBe(share.commonCents + share.alcoholCents);
    }
    expect(shares.reduce((sum, s) => sum + s.totalCents, 0)).toBe(
      123457 + 9999,
    );
  });

  it('chalé só com crianças participa do rateio comum', () => {
    const shares = strategy.calculate({
      occupancies: [
        occupancy({ chaletId: 'a', children: 2 }), // peso 10
        occupancy({ chaletId: 'b', adults: 1 }), // peso 10
      ],
      commonTotal: Money.fromCents(1000),
      alcoholTotal: Money.zero(),
    });
    expect(shares.map((s) => s.commonCents)).toEqual([500, 500]);
  });

  it('erro se há despesa de álcool e nenhum consumidor', () => {
    expect(() =>
      strategy.calculate({
        occupancies: [occupancy({ chaletId: 'a', adults: 2 })],
        commonTotal: Money.zero(),
        alcoholTotal: Money.fromCents(5000),
      }),
    ).toThrow(ValidationError);
  });

  it('erro se há despesa comum e nenhum hóspede', () => {
    expect(() =>
      strategy.calculate({
        occupancies: [],
        commonTotal: Money.fromCents(5000),
        alcoholTotal: Money.zero(),
      }),
    ).toThrow(ValidationError);
  });

  it('evento sem compras gera rateio zerado', () => {
    const shares = strategy.calculate({
      occupancies: [occupancy({ chaletId: 'a', adults: 2 })],
      commonTotal: Money.zero(),
      alcoholTotal: Money.zero(),
    });
    expect(shares).toEqual([
      { chaletId: 'a', commonCents: 0, alcoholCents: 0, totalCents: 0 },
    ]);
  });
});
