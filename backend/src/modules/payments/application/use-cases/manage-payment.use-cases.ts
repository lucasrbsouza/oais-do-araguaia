import { Injectable } from '@nestjs/common';
import { Payment, Role } from '@prisma/client';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { ChaletRepository } from '../../../chalets/domain/chalet.repository';
import { EventRepository } from '../../../events/domain/event.repository';
import { PurchaseRepository } from '../../../purchases/domain/purchase.repository';
import { SettlementRepository } from '../../../settlement/domain/settlement.repository';
import {
  derivePaymentStatus,
  PaymentStatus,
} from '../../domain/payment-status';
import { PaymentRepository } from '../../domain/payment.repository';

export interface RegisterPaymentInput {
  eventId: string;
  chaletId: string;
  date: Date;
  amountCents: number;
  notes?: string;
}

export interface ChaletPaymentSummary {
  chaletId: string;
  chaletNumber: number;
  chaletName: string;
  ownerName: string | null;
  owedCents: number;
  paidCents: number;
  /** Compras/adiantamentos lançados vinculados ao chalé. */
  advanceCents: number;
  /** Saldo devedor: devido − pago − adiantamentos (negativo = crédito). */
  balanceCents: number;
  status: PaymentStatus;
  payments: Array<{
    id: string;
    date: Date;
    amountCents: number;
    notes: string | null;
  }>;
}

@Injectable()
export class RegisterPaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly eventRepository: EventRepository,
    private readonly chaletRepository: ChaletRepository,
  ) {}

  async execute(
    input: RegisterPaymentInput,
    registeredById: string,
  ): Promise<Payment> {
    const event = await this.eventRepository.findById(input.eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    const chalet = await this.chaletRepository.findById(input.chaletId);
    if (!chalet) {
      throw new NotFoundError('Chalé não encontrado.');
    }
    return this.paymentRepository.create({ ...input, registeredById });
  }
}

@Injectable()
export class GetEventPaymentsUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly purchaseRepository: PurchaseRepository,
    private readonly settlementRepository: SettlementRepository,
    private readonly chaletRepository: ChaletRepository,
  ) {}

  async execute(
    eventId: string,
    user: AuthenticatedUser,
  ): Promise<ChaletPaymentSummary[]> {
    const settlement = await this.settlementRepository.findByEvent(eventId);
    if (!settlement) {
      throw new NotFoundError('Rateio ainda não calculado para este evento.');
    }

    const payments = await this.paymentRepository.listByEvent(eventId);
    const paymentsByChalet = new Map<string, Payment[]>();
    for (const payment of payments) {
      const list = paymentsByChalet.get(payment.chaletId) ?? [];
      list.push(payment);
      paymentsByChalet.set(payment.chaletId, list);
    }

    const advances = await this.purchaseRepository.advancesByEvent(eventId);
    const advancesByChalet = new Map(
      advances.map((a) => [a.chaletId, a.totalCents]),
    );

    const chalets = await this.chaletRepository.list();
    const ownerNameByChalet = new Map(
      chalets.map((c) => [c.id, c.owner?.name ?? null]),
    );

    let items = settlement.items;
    if (user.role !== Role.ADMIN) {
      const ownChalets = await this.chaletRepository.findByOwner(user.id);
      const ownIds = new Set(ownChalets.map((c) => c.id));
      items = items.filter((item) => ownIds.has(item.chaletId));
      if (items.length === 0) {
        throw new ForbiddenError('Você não possui chalé neste rateio.');
      }
    }

    return items.map((item) => {
      const chaletPayments = paymentsByChalet.get(item.chaletId) ?? [];
      const paidCents = chaletPayments.reduce(
        (sum, p) => sum + p.amountCents,
        0,
      );
      const advanceCents = advancesByChalet.get(item.chaletId) ?? 0;
      return {
        chaletId: item.chaletId,
        chaletNumber: item.chaletNumber,
        chaletName: item.chaletName,
        ownerName: ownerNameByChalet.get(item.chaletId) ?? null,
        owedCents: item.totalCents,
        paidCents,
        advanceCents,
        balanceCents: item.totalCents - paidCents - advanceCents,
        status: derivePaymentStatus(item.totalCents, paidCents + advanceCents),
        payments: chaletPayments.map((p) => ({
          id: p.id,
          date: p.date,
          amountCents: p.amountCents,
          notes: p.notes,
        })),
      };
    });
  }
}
