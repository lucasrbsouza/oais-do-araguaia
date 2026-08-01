import {
  derivePaymentStatus,
  netPaidCents,
  PaymentStatus,
} from './payment-status';

describe('netPaidCents', () => {
  it('soma pagamentos e adiantamentos', () => {
    expect(netPaidCents(1000, 500, 0)).toBe(1500);
  });

  it('desconta devolução já quitada', () => {
    expect(netPaidCents(1000, 500, 300)).toBe(1200);
  });

  it('fica negativo quando a devolução passa do que o chalé bancou', () => {
    // Devolveram 1500 a quem só tinha posto 1000: o chalé passou a dever.
    expect(netPaidCents(1000, 0, 1500)).toBe(-500);
    expect(derivePaymentStatus(2000, netPaidCents(1000, 0, 1500))).toBe(
      PaymentStatus.PENDING,
    );
  });
});

describe('derivePaymentStatus', () => {
  it('sem pagamento e com dívida → PENDENTE', () => {
    expect(derivePaymentStatus(10000, 0)).toBe(PaymentStatus.PENDING);
  });

  it('pagamento menor que a dívida → PARCIAL', () => {
    expect(derivePaymentStatus(10000, 5000)).toBe(PaymentStatus.PARTIAL);
  });

  it('pagamento igual à dívida → PAGO', () => {
    expect(derivePaymentStatus(10000, 10000)).toBe(PaymentStatus.PAID);
  });

  it('pagamento maior que a dívida → PAGO', () => {
    expect(derivePaymentStatus(10000, 12000)).toBe(PaymentStatus.PAID);
  });

  it('dívida zero → PAGO', () => {
    expect(derivePaymentStatus(0, 0)).toBe(PaymentStatus.PAID);
  });
});
