import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';

export interface AuditEntry {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export interface ListAuditFilter {
  userId?: string;
  entity?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page: number;
  perPage: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: Date;
  user: { id: string; name: string; email: string } | null;
}

export interface PaginatedAuditLogs {
  data: AuditLogItem[];
  total: number;
  page: number;
  perPage: number;
}

const chaletLabel = (chalet: { number: number; name: string }): string =>
  `${chalet.number} — ${chalet.name}`;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fotografia legível do registro afetado, gravada junto do log para que a
   * auditoria mostre "o quê" aconteceu sem depender de IDs. Em exclusões deve
   * ser chamada antes da operação, enquanto o registro ainda existe.
   */
  async describeEntity(
    entity: string,
    id: string,
  ): Promise<Record<string, unknown> | undefined> {
    switch (entity) {
      case 'User': {
        const user = await this.prisma.user.findUnique({
          where: { id },
          select: { name: true, email: true, role: true, active: true },
        });
        return user
          ? {
              userName: user.name,
              userEmail: user.email,
              userRole: user.role,
              userActive: user.active,
            }
          : undefined;
      }

      case 'Chalet': {
        const chalet = await this.prisma.chalet.findUnique({
          where: { id },
          select: {
            number: true,
            name: true,
            status: true,
            owner: { select: { name: true } },
          },
        });
        return chalet
          ? {
              chalet: chaletLabel(chalet),
              chaletStatus: chalet.status,
              chaletOwner: chalet.owner?.name ?? null,
            }
          : undefined;
      }

      case 'Event': {
        const event = await this.prisma.event.findUnique({
          where: { id },
          select: {
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        });
        return event
          ? {
              event: event.name,
              eventStart: event.startDate,
              eventEnd: event.endDate,
              eventStatus: event.status,
            }
          : undefined;
      }

      case 'Reservation': {
        const reservation = await this.prisma.reservation.findUnique({
          where: { id },
          select: {
            checkIn: true,
            checkOut: true,
            adults: true,
            children: true,
            alcoholConsumers: true,
            notes: true,
            status: true,
            event: { select: { name: true } },
            chalet: { select: { number: true, name: true } },
            responsible: { select: { name: true } },
          },
        });
        return reservation
          ? {
              event: reservation.event.name,
              chalet: chaletLabel(reservation.chalet),
              responsible: reservation.responsible.name,
              checkIn: reservation.checkIn,
              checkOut: reservation.checkOut,
              adults: reservation.adults,
              children: reservation.children,
              alcoholConsumers: reservation.alcoholConsumers,
              notes: reservation.notes,
              reservationStatus: reservation.status,
            }
          : undefined;
      }

      case 'Purchase': {
        const purchase = await this.prisma.purchase.findUnique({
          where: { id },
          select: {
            date: true,
            description: true,
            category: true,
            amountCents: true,
            receiptPath: true,
            event: { select: { name: true } },
            chalet: { select: { number: true, name: true } },
            responsible: { select: { name: true } },
          },
        });
        return purchase
          ? {
              event: purchase.event.name,
              description: purchase.description,
              category: purchase.category,
              amountCents: purchase.amountCents,
              purchaseDate: purchase.date,
              responsible: purchase.responsible.name,
              chalet: purchase.chalet ? chaletLabel(purchase.chalet) : null,
              hasReceipt: purchase.receiptPath !== null,
            }
          : undefined;
      }

      // O settlement é identificado pelo evento (relação 1:1).
      case 'Settlement': {
        const event = await this.prisma.event.findUnique({
          where: { id },
          select: {
            name: true,
            settlement: { select: { items: { select: { totalCents: true } } } },
          },
        });
        if (!event) return undefined;
        const items = event.settlement?.items ?? [];
        return {
          event: event.name,
          totalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
          chaletsCount: items.length,
        };
      }

      case 'Payment': {
        const payment = await this.prisma.payment.findUnique({
          where: { id },
          select: {
            date: true,
            amountCents: true,
            notes: true,
            event: { select: { name: true } },
            chalet: { select: { number: true, name: true } },
          },
        });
        return payment
          ? {
              event: payment.event.name,
              chalet: chaletLabel(payment.chalet),
              amountCents: payment.amountCents,
              paymentDate: payment.date,
              notes: payment.notes,
            }
          : undefined;
      }

      case 'Receivable': {
        const receivable = await this.prisma.receivable.findUnique({
          where: { id },
          select: {
            amountCents: true,
            status: true,
            notes: true,
            event: { select: { name: true } },
            chalet: { select: { number: true, name: true } },
          },
        });
        return receivable
          ? {
              event: receivable.event.name,
              chalet: chaletLabel(receivable.chalet),
              amountCents: receivable.amountCents,
              receivableStatus: receivable.status,
              notes: receivable.notes,
            }
          : undefined;
      }

      default:
        return undefined;
    }
  }

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        metadata: entry.metadata as Prisma.InputJsonValue | undefined,
        ip: entry.ip,
      },
    });
  }

  async list(filter: ListAuditFilter): Promise<PaginatedAuditLogs> {
    const where: Prisma.AuditLogWhereInput = {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.entity ? { entity: filter.entity } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata,
        ip: log.ip,
        createdAt: log.createdAt,
        user: log.user,
      })),
      total,
      page: filter.page,
      perPage: filter.perPage,
    };
  }
}
