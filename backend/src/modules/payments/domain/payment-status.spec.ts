import { derivePaymentStatus, PaymentStatus } from './payment-status';

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
