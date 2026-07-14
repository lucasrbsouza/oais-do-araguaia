const MS_PER_DAY = 86_400_000;

/** Entradas simultâneas permitidas por chalé (uma por suíte). */
export const SUITES_PER_CHALET = 3;

export interface StayPeriod {
  checkIn: Date;
  checkOut: Date;
}

/**
 * Diárias da estadia. Entrada e saída no mesmo dia (bate-volta) conta 1 diária:
 * o hóspede consome o rateio do dia mesmo sem dormir.
 */
export function nightsOf(stay: StayPeriod): number {
  const days = Math.round(
    (stay.checkOut.getTime() - stay.checkIn.getTime()) / MS_PER_DAY,
  );
  return Math.max(1, days);
}

/** Saída efetiva: o bate-volta ocupa a suíte pelo dia da entrada. */
function occupiedUntil(stay: StayPeriod): number {
  return Math.max(
    stay.checkOut.getTime(),
    stay.checkIn.getTime() + MS_PER_DAY,
  );
}

/**
 * Estadias são meio-abertas: [entrada, saída). Quem sai dia 10 libera a suíte
 * para quem entra dia 10 — troca no mesmo dia não é sobreposição.
 */
export function staysOverlap(a: StayPeriod, b: StayPeriod): boolean {
  return (
    a.checkIn.getTime() < occupiedUntil(b) &&
    b.checkIn.getTime() < occupiedUntil(a)
  );
}
