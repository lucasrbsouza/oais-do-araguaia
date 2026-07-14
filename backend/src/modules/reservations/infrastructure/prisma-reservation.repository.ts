import { Injectable } from '@nestjs/common';
import { Reservation } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  CreateReservationData,
  ListReservationsFilter,
  ReservationDetail,
  ReservationRepository,
  UpdateReservationData,
} from '../domain/reservation.repository';

const detailInclude = { chalet: true, responsible: true } as const;

@Injectable()
export class PrismaReservationRepository implements ReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ReservationDetail | null> {
    return this.prisma.reservation.findUnique({
      where: { id },
      include: detailInclude,
    });
  }

  listActiveByEventAndChalet(
    eventId: string,
    chaletId: string,
  ): Promise<Reservation[]> {
    return this.prisma.reservation.findMany({
      where: { eventId, chaletId, status: 'ACTIVE' },
    });
  }

  create(data: CreateReservationData): Promise<ReservationDetail> {
    return this.prisma.reservation.create({ data, include: detailInclude });
  }

  update(id: string, data: UpdateReservationData): Promise<ReservationDetail> {
    return this.prisma.reservation.update({
      where: { id },
      data,
      include: detailInclude,
    });
  }

  cancel(id: string): Promise<ReservationDetail> {
    return this.prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: detailInclude,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.reservation.delete({ where: { id } });
  }

  list(filter: ListReservationsFilter): Promise<ReservationDetail[]> {
    return this.prisma.reservation.findMany({
      where: {
        // Listagens gerais (calendário, reservas) escondem eventos cancelados;
        // a aba de reservas de um evento específico continua mostrando.
        ...(filter.eventId
          ? { eventId: filter.eventId }
          : { event: { status: { not: 'CANCELLED' } } }),
        ...(filter.chaletId ? { chaletId: filter.chaletId } : {}),
        ...(filter.responsibleId
          ? { responsibleId: filter.responsibleId }
          : {}),
        ...(filter.chaletOwnerId
          ? { chalet: { ownerId: filter.chaletOwnerId } }
          : {}),
        ...(filter.from ? { checkOut: { gte: filter.from } } : {}),
        ...(filter.to ? { checkIn: { lte: filter.to } } : {}),
      },
      include: detailInclude,
      orderBy: [{ checkIn: 'asc' }, { chalet: { number: 'asc' } }],
    });
  }
}
