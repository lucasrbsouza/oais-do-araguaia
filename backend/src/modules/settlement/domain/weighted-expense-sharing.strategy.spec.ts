import { ValidationError } from '../../../shared/domain/domain-error';
import { Money } from '../../../shared/domain/money';
import { ChaletStay } from './expense-sharing.strategy';
import { WeightedExpenseSharingStrategy } from './weighted-expense-sharing.strategy';

const stay = (
  partial: Partial<ChaletStay> & { chaletId: string },
): ChaletStay => ({
  adults: 0,
  children: 0,
  alcoholConsumers: 0,
  nights: 1,
  ...partial,
});

describe('WeightedExpenseSharingStrategy', () => {
  const strategy = new WeightedExpenseSharingStrategy();

  it('divide despesas comuns por peso: adulto 1.0, criança 0.5', () => {
    const shares = strategy.calculate({
      stays: [
        stay({ chaletId: 'a', adults: 2 }), // peso 20
        stay({ chaletId: 'b', adults: 1, children: 2 }), // peso 20
        stay({ chaletId: 'c', adults: 1 }), // peso 10
      ],
      commonTotal: Money.fromCents(50000),
      alcoholTotal: Money.zero(),
    });

    expect(shares.map((s) => s.commonCents)).toEqual([20000, 20000, 10000]);
    expect(shares.every((s) => s.alcoholCents === 0)).toBe(true);
  });

  it('divide álcool apenas entre consumidores marcados', () => {
    const shares = strategy.calculate({
      stays: [
        stay({ chaletId: 'a', adults: 4, alcoholConsumers: 3 }),
        stay({ chaletId: 'b', adults: 2, alcoholConsumers: 0 }),
        stay({ chaletId: 'c', adults: 1, alcoholConsumers: 1 }),
      ],
      commonTotal: Money.zero(),
      alcoholTotal: Money.fromCents(20000),
    });

    expect(shares.map((s) => s.alcoholCents)).toEqual([15000, 0, 5000]);
  });

  it('pondera o rateio comum pelas diárias de cada entrada', () => {
    // 2 adultos × 4 diárias = 80 vs 2 adultos × 1 diária = 20.
    const shares = strategy.calculate({
      stays: [
        stay({ chaletId: 'a', adults: 2, nights: 4 }),
        stay({ chaletId: 'b', adults: 2, nights: 1 }),
      ],
      commonTotal: Money.fromCents(100000),
      alcoholTotal: Money.zero(),
    });

    expect(shares.map((s) => s.commonCents)).toEqual([80000, 20000]);
  });

  it('pondera o álcool pelas diárias: quem bebe menos noites paga menos', () => {
    const shares = strategy.calculate({
      stays: [
        stay({ chaletId: 'a', adults: 2, alcoholConsumers: 2, nights: 4 }), // 8
        stay({ chaletId: 'b', adults: 1, alcoholConsumers: 1, nights: 2 }), // 2
      ],
      commonTotal: Money.zero(),
      alcoholTotal: Money.fromCents(40000),
    });

    expect(shares.map((s) => s.alcoholCents)).toEqual([32000, 8000]);
  });

  it('soma as entradas do mesmo chalé em uma única cota', () => {
    // Chalé b recebe dois grupos: 2 adultos × 1 diária (20) + 3 adultos ×
    // 2 diárias (60) = 80, empatando com o chalé a (2 adultos × 4 = 80).
    const shares = strategy.calculate({
      stays: [
        stay({ chaletId: 'a', adults: 2, nights: 4 }),
        stay({ chaletId: 'b', adults: 2, nights: 1 }),
        stay({ chaletId: 'b', adults: 3, nights: 2 }),
      ],
      commonTotal: Money.fromCents(160000),
      alcoholTotal: Money.zero(),
    });

    expect(shares).toHaveLength(2);
    expect(shares.map((s) => s.chaletId)).toEqual(['a', 'b']);
    expect(shares.map((s) => s.commonCents)).toEqual([80000, 80000]);
  });

  it('total do chalé = comum + álcool e soma geral fecha', () => {
    const shares = strategy.calculate({
      stays: [
        stay({
          chaletId: 'a',
          adults: 3,
          children: 1,
          alcoholConsumers: 2,
          nights: 3,
        }),
        stay({
          chaletId: 'b',
          adults: 2,
          children: 3,
          alcoholConsumers: 1,
          nights: 2,
        }),
        stay({ chaletId: 'b', adults: 1, alcoholConsumers: 1, nights: 1 }),
        stay({ chaletId: 'c', adults: 5, alcoholConsumers: 0, nights: 4 }),
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
      stays: [
        stay({ chaletId: 'a', children: 2 }), // peso 10
        stay({ chaletId: 'b', adults: 1 }), // peso 10
      ],
      commonTotal: Money.fromCents(1000),
      alcoholTotal: Money.zero(),
    });
    expect(shares.map((s) => s.commonCents)).toEqual([500, 500]);
  });

  it('erro se há despesa de álcool e nenhum consumidor', () => {
    expect(() =>
      strategy.calculate({
        stays: [stay({ chaletId: 'a', adults: 2 })],
        commonTotal: Money.zero(),
        alcoholTotal: Money.fromCents(5000),
      }),
    ).toThrow(ValidationError);
  });

  it('erro se há despesa comum e nenhum hóspede', () => {
    expect(() =>
      strategy.calculate({
        stays: [],
        commonTotal: Money.fromCents(5000),
        alcoholTotal: Money.zero(),
      }),
    ).toThrow(ValidationError);
  });

  it('evento sem compras gera rateio zerado', () => {
    const shares = strategy.calculate({
      stays: [stay({ chaletId: 'a', adults: 2 })],
      commonTotal: Money.zero(),
      alcoholTotal: Money.zero(),
    });
    expect(shares).toEqual([
      { chaletId: 'a', commonCents: 0, alcoholCents: 0, totalCents: 0 },
    ]);
  });
});
