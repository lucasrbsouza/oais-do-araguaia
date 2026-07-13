import { Prisma, ReceivableStatus } from '@prisma/client';
import { SettlementShare } from '../domain/expense-sharing.strategy';

/**
 * Recria as contas a receber do evento a partir do rateio informado:
 * se pagamentos + adiantamentos (compras vinculadas ao chalé) superam o
 * devido, o excedente vira crédito. Devoluções já quitadas permanecem no
 * histórico e são abatidas do crédito recalculado.
 *
 * Executa a cada gravação de rateio (cálculo manual e encerramento).
 */
export async function syncEventReceivables(
  tx: Prisma.TransactionClient,
  eventId: string,
  shares: SettlementShare[],
): Promise<void> {
  await tx.receivable.deleteMany({
    where: { eventId, status: ReceivableStatus.OPEN },
  });

  const [payments, advances, settled] = await Promise.all([
    tx.payment.groupBy({
      by: ['chaletId'],
      where: { eventId },
      _sum: { amountCents: true },
    }),
    tx.purchase.groupBy({
      by: ['chaletId'],
      where: { eventId, chaletId: { not: null } },
      _sum: { amountCents: true },
    }),
    tx.receivable.groupBy({
      by: ['chaletId'],
      where: { eventId, status: ReceivableStatus.SETTLED },
      _sum: { amountCents: true },
    }),
  ]);
  const paidByChalet = new Map(
    payments.map((p) => [p.chaletId, p._sum.amountCents ?? 0]),
  );
  const advanceByChalet = new Map(
    advances.map((a) => [a.chaletId as string, a._sum.amountCents ?? 0]),
  );
  const settledByChalet = new Map(
    settled.map((s) => [s.chaletId, s._sum.amountCents ?? 0]),
  );

  const credits = shares
    .map((share) => ({
      chaletId: share.chaletId,
      amountCents:
        (paidByChalet.get(share.chaletId) ?? 0) +
        (advanceByChalet.get(share.chaletId) ?? 0) -
        (settledByChalet.get(share.chaletId) ?? 0) -
        share.totalCents,
    }))
    .filter((credit) => credit.amountCents > 0);
  if (credits.length > 0) {
    await tx.receivable.createMany({
      data: credits.map((credit) => ({
        eventId,
        chaletId: credit.chaletId,
        amountCents: credit.amountCents,
      })),
    });
  }
}
