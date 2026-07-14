const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Diárias da estadia — a base do rateio. Entrada e saída no mesmo dia
 * (bate-volta) conta 1: o hóspede consome o rateio do dia mesmo sem dormir.
 */
export function nightsBetween(checkIn: string | Date, checkOut: string | Date): number {
  const start = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const end = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, days);
}

/** Converte "1.234,56" ou "1234.56" para centavos inteiros. */
export function parseBRLToCents(input: string): number {
  const normalized = input.replace(/\./g, '').replace(',', '.');
  return Math.round(Number(normalized) * 100);
}
