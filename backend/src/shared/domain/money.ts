import { ValidationError } from './domain-error';

/**
 * Valor monetário em centavos (inteiro). Nunca usar float para dinheiro.
 */
export class Money {
  private constructor(readonly cents: number) {}

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new ValidationError(
        'Valor monetário deve ser um inteiro em centavos.',
      );
    }
    if (cents < 0) {
      throw new ValidationError('Valor monetário não pode ser negativo.');
    }
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  /**
   * Divide o total proporcionalmente aos pesos usando o método do maior resto
   * (largest remainder): a soma das partes fecha EXATAMENTE com o total.
   * Pesos zero recebem zero.
   */
  allocateByWeights(weights: number[]): Money[] {
    if (weights.some((w) => !Number.isInteger(w) || w < 0)) {
      throw new ValidationError(
        'Pesos de rateio devem ser inteiros não negativos.',
      );
    }
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) {
      if (this.cents > 0) {
        throw new ValidationError(
          'Não é possível ratear um valor sem participantes.',
        );
      }
      return weights.map(() => Money.zero());
    }

    const shares = weights.map((weight, index) => {
      const exact = this.cents * weight;
      return {
        index,
        floor: Math.floor(exact / totalWeight),
        remainder: exact % totalWeight,
      };
    });

    let leftover = this.cents - shares.reduce((sum, s) => sum + s.floor, 0);
    const byRemainder = [...shares].sort(
      (a, b) => b.remainder - a.remainder || a.index - b.index,
    );
    for (const share of byRemainder) {
      if (leftover === 0) break;
      share.floor += 1;
      leftover -= 1;
    }

    return shares.map((s) => new Money(s.floor));
  }
}
