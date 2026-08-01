export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

/**
 * Quanto o chalé de fato bancou: pagamentos + adiantamentos − devoluções já
 * quitadas.
 *
 * Descontar a devolução é o que mantém a dívida visível. Se o rateio for
 * recalculado para cima depois de o chalé já ter recebido o crédito de volta,
 * o dinheiro devolvido não pode continuar contando como pago — senão o chalé
 * aparece quitado devendo.
 */
export function netPaidCents(
  paidCents: number,
  advanceCents: number,
  refundedCents: number,
): number {
  return paidCents + advanceCents - refundedCents;
}

export function derivePaymentStatus(
  owedCents: number,
  paidCents: number,
): PaymentStatus {
  if (paidCents <= 0 && owedCents > 0) return PaymentStatus.PENDING;
  if (paidCents < owedCents) return PaymentStatus.PARTIAL;
  return PaymentStatus.PAID;
}
