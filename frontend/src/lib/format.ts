const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** Converte "1.234,56" ou "1234.56" para centavos inteiros. */
export function parseBRLToCents(input: string): number {
  const normalized = input.replace(/\./g, '').replace(',', '.');
  return Math.round(Number(normalized) * 100);
}
