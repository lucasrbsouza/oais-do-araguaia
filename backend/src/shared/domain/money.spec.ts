import { ValidationError } from './domain-error';
import { Money } from './money';

describe('Money', () => {
  it('rejeita valores não inteiros', () => {
    expect(() => Money.fromCents(10.5)).toThrow(ValidationError);
  });

  it('rejeita valores negativos', () => {
    expect(() => Money.fromCents(-1)).toThrow(ValidationError);
  });

  describe('allocateByWeights', () => {
    it('divide proporcionalmente e a soma fecha com o total', () => {
      const shares = Money.fromCents(10000).allocateByWeights([10, 10, 10]);
      expect(shares.map((s) => s.cents)).toEqual([3334, 3333, 3333]);
      expect(shares.reduce((sum, s) => sum + s.cents, 0)).toBe(10000);
    });

    it('respeita pesos diferentes', () => {
      const shares = Money.fromCents(9000).allocateByWeights([20, 10]);
      expect(shares.map((s) => s.cents)).toEqual([6000, 3000]);
    });

    it('peso zero recebe zero', () => {
      const shares = Money.fromCents(500).allocateByWeights([0, 5]);
      expect(shares.map((s) => s.cents)).toEqual([0, 500]);
    });

    it('total zero distribui zeros mesmo sem participantes', () => {
      const shares = Money.zero().allocateByWeights([0, 0]);
      expect(shares.map((s) => s.cents)).toEqual([0, 0]);
    });

    it('lança erro ao ratear valor positivo sem participantes', () => {
      expect(() => Money.fromCents(100).allocateByWeights([0, 0])).toThrow(
        ValidationError,
      );
    });

    it('propriedade: soma sempre fecha exata para combinações variadas', () => {
      const totals = [1, 3, 99, 101, 12345, 999999];
      const weightSets = [
        [10],
        [10, 5],
        [10, 10, 5, 5],
        [15, 25, 10, 30, 5],
        [1, 2, 3, 4, 5, 6, 7],
      ];
      for (const total of totals) {
        for (const weights of weightSets) {
          const shares = Money.fromCents(total).allocateByWeights(weights);
          expect(shares.reduce((sum, s) => sum + s.cents, 0)).toBe(total);
        }
      }
    });
  });
});
