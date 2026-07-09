export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

export function derivePaymentStatus(
  owedCents: number,
  paidCents: number,
): PaymentStatus {
  if (paidCents <= 0 && owedCents > 0) return PaymentStatus.PENDING;
  if (paidCents < owedCents) return PaymentStatus.PARTIAL;
  return PaymentStatus.PAID;
}
