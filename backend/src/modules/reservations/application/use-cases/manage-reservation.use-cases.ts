import { Injectable } from '@nestjs/common';
import { Event, EventStatus, Role } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/domain-error';
import { DateRange } from '../../../../shared/domain/date-range';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { ChaletRepository } from '../../../chalets/domain/chalet.repository';
import { EventRepository } from '../../../events/domain/event.repository';
import {
  ListReservationsFilter,
  ReservationDetail,
  ReservationRepository,
} from '../../domain/reservation.repository';
import {
  ReservationResponse,
  toReservationResponse,
} from '../reservation.mapper';

export interface CreateReservationInput {
  eventId: string;
  chaletId: string;
  responsibleId?: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  alcoholConsumers: number;
  notes?: string;
}

export interface UpdateReservationInput {
  id: string;
  checkIn?: Date;
  checkOut?: Date;
  adults?: number;
  children?: number;
  alcoholConsumers?: number;
  notes?: string;
}

function ensureEventOpen(event: Event): void {
  if (event.status === EventStatus.CLOSED) {
    throw new ConflictError(
      'Evento encerrado: reservas não podem ser alteradas.',
    );
  }
}

function ensureStayWithinEvent(
  event: Event,
  checkIn: Date,
  checkOut: Date,
): void {
  const eventRange = DateRange.create(event.startDate, event.endDate);
  const stay = DateRange.create(checkIn, checkOut);
  if (!eventRange.contains(stay)) {
    throw new ValidationError(
      'Entrada e saída devem estar dentro do período do evento.',
    );
  }
}

function ensureCanManage(
  reservation: ReservationDetail,
  user: AuthenticatedUser,
): void {
  if (user.role === Role.ADMIN) return;
  const isResponsible = reservation.responsibleId === user.id;
  const isChaletOwner = reservation.chalet.ownerId === user.id;
  if (!isResponsible && !isChaletOwner) {
    throw new ForbiddenError(
      'Você só pode alterar reservas do seu próprio chalé.',
    );
  }
}

@Injectable()
export class CreateReservationUseCase {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly eventRepository: EventRepository,
    private readonly chaletRepository: ChaletRepository,
  ) {}

  async execute(
    input: CreateReservationInput,
    user: AuthenticatedUser,
  ): Promise<ReservationResponse> {
    const event = await this.eventRepository.findById(input.eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    ensureEventOpen(event);
    ensureStayWithinEvent(event, input.checkIn, input.checkOut);

    const chalet = await this.chaletRepository.findById(input.chaletId);
    if (!chalet) {
      throw new NotFoundError('Chalé não encontrado.');
    }
    if (user.role !== Role.ADMIN && chalet.ownerId !== user.id) {
      throw new ForbiddenError('Você só pode reservar o seu próprio chalé.');
    }

    const existing =
      await this.reservationRepository.findActiveByEventAndChalet(
        input.eventId,
        input.chaletId,
      );
    if (existing) {
      throw new ConflictError(
        'Este chalé já possui reserva ativa neste evento.',
      );
    }

    const responsibleId =
      user.role === Role.ADMIN && input.responsibleId
        ? input.responsibleId
        : user.id;

    const reservation = await this.reservationRepository.create({
      eventId: input.eventId,
      chaletId: input.chaletId,
      responsibleId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      alcoholConsumers: input.alcoholConsumers,
      notes: input.notes,
    });
    return toReservationResponse(reservation);
  }
}

@Injectable()
export class UpdateReservationUseCase {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly eventRepository: EventRepository,
  ) {}

  async execute(
    input: UpdateReservationInput,
    user: AuthenticatedUser,
  ): Promise<ReservationResponse> {
    const reservation = await this.reservationRepository.findById(input.id);
    if (!reservation) {
      throw new NotFoundError('Reserva não encontrada.');
    }
    ensureCanManage(reservation, user);

    const event = await this.eventRepository.findById(reservation.eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    ensureEventOpen(event);
    ensureStayWithinEvent(
      event,
      input.checkIn ?? reservation.checkIn,
      input.checkOut ?? reservation.checkOut,
    );

    const updated = await this.reservationRepository.update(input.id, {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      alcoholConsumers: input.alcoholConsumers,
      notes: input.notes,
    });
    return toReservationResponse(updated);
  }
}

@Injectable()
export class CancelReservationUseCase {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly eventRepository: EventRepository,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ReservationResponse> {
    const reservation = await this.reservationRepository.findById(id);
    if (!reservation) {
      throw new NotFoundError('Reserva não encontrada.');
    }
    ensureCanManage(reservation, user);

    const event = await this.eventRepository.findById(reservation.eventId);
    if (event) {
      ensureEventOpen(event);
    }

    const cancelled = await this.reservationRepository.cancel(id);
    return toReservationResponse(cancelled);
  }
}

@Injectable()
export class ListReservationsUseCase {
  constructor(private readonly reservationRepository: ReservationRepository) {}

  async execute(
    filter: ListReservationsFilter,
  ): Promise<ReservationResponse[]> {
    const reservations = await this.reservationRepository.list(filter);
    return reservations.map(toReservationResponse);
  }
}
