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

  findActiveByEventAndChalet(
    eventId: string,
    chaletId: string,
  ): Promise<Reservation | null> {
    return this.prisma.reservation.findFirst({
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

  list(filter: ListReservationsFilter): Promise<ReservationDetail[]> {
    return this.prisma.reservation.findMany({
      where: {
        ...(filter.eventId ? { eventId: filter.eventId } : {}),
        ...(filter.chaletId ? { chaletId: filter.chaletId } : {}),
        ...(filter.responsibleId
          ? { responsibleId: filter.responsibleId }
          : {}),
        ...(filter.from ? { checkOut: { gte: filter.from } } : {}),
        ...(filter.to ? { checkIn: { lte: filter.to } } : {}),
      },
      include: detailInclude,
      orderBy: [{ checkIn: 'asc' }, { chalet: { number: 'asc' } }],
    });
  }
}
