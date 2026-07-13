import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventStatus, SettlementAutoMode } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { CalculateSettlementUseCase } from './use-cases/calculate-settlement.use-case';

/**
 * Rateio automático (configurado por evento, apenas admin):
 * - ON_PURCHASE: recalcula após cada compra criada/alterada/excluída;
 * - INTERVAL: recalcula a cada N minutos (cron), enquanto o evento
 *   estiver aberto e houver compras.
 */
@Injectable()
export class AutoSettlementService {
  private readonly logger = new Logger(AutoSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculateSettlement: CalculateSettlementUseCase,
  ) {}

  /** Chamado pelas use cases de compras após qualquer mutação. */
  async onPurchaseChange(eventId: string, userId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { status: true, settlementAutoMode: true },
    });
    if (
      event?.status !== EventStatus.OPEN ||
      event.settlementAutoMode !== SettlementAutoMode.ON_PURCHASE
    ) {
      return;
    }
    await this.recalculate(eventId, userId);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async recalculateDueEvents(): Promise<void> {
    const events = await this.prisma.event.findMany({
      where: {
        status: EventStatus.OPEN,
        settlementAutoMode: SettlementAutoMode.INTERVAL,
        settlementAutoMinutes: { not: null },
      },
      select: {
        id: true,
        settlementAutoMinutes: true,
        settlementAutoSetById: true,
        settlement: { select: { computedAt: true } },
      },
    });

    const now = Date.now();
    for (const event of events) {
      const intervalMs = (event.settlementAutoMinutes ?? 0) * 60_000;
      const lastComputed = event.settlement?.computedAt.getTime() ?? 0;
      if (now - lastComputed < intervalMs) continue;
      if (!event.settlementAutoSetById) continue;
      await this.recalculate(event.id, event.settlementAutoSetById);
    }
  }

  private async recalculate(eventId: string, userId: string): Promise<void> {
    try {
      await this.calculateSettlement.execute(eventId, userId);
    } catch (error) {
      // Evento sem reservas/compras ou fechado entre a checagem e o cálculo:
      // não deve derrubar a operação que disparou o recálculo.
      this.logger.warn(
        `Rateio automático falhou para o evento ${eventId}: ${(error as Error).message}`,
      );
    }
  }
}
