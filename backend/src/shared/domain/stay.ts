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
  return Math.max(stay.checkOut.getTime(), stay.checkIn.getTime() + MS_PER_DAY);
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

/** A estadia está acontecendo no dia informado? */
export function stayCoversDay(stay: StayPeriod, day: Date): boolean {
  return (
    stay.checkIn.getTime() <= day.getTime() &&
    day.getTime() < occupiedUntil(stay)
  );
}

/** Fuso do condomínio — o dia vira aqui, não no relógio UTC do servidor. */
const CONDO_TIMEZONE = 'America/Sao_Paulo';

/**
 * Hoje no fuso do condomínio, à meia-noite UTC — mesmo formato das colunas
 * `@db.Date` de check-in/check-out, para comparar dia com dia.
 */
export function todayAsUtcDate(now: Date = new Date()): Date {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: CONDO_TIMEZONE,
  }).format(now);
  return new Date(`${day}T00:00:00.000Z`);
}
