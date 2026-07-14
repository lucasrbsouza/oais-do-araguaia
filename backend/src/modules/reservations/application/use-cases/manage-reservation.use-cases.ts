import { Injectable } from '@nestjs/common';
import { Event, EventStatus, Reservation, Role } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/domain-error';
import { DateRange } from '../../../../shared/domain/date-range';
import {
  StayPeriod,
  SUITES_PER_CHALET,
  staysOverlap,
} from '../../../../shared/domain/stay';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { ChaletRepository } from '../../../chalets/domain/chalet.repository';
import { EventRepository } from '../../../events/domain/event.repository';
import {
  ListReservationsFilter,
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
  if (event.status !== EventStatus.OPEN) {
    const label =
      event.status === EventStatus.CLOSED ? 'encerrado' : 'cancelado';
    throw new ConflictError(
      `Evento ${label}: reservas não podem ser alteradas.`,
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

function ensureCanManage(user: AuthenticatedUser): void {
  if (user.role !== Role.ADMIN) {
    throw new ForbiddenError(
      'Somente administradores podem alterar reservas.',
    );
  }
}

/**
 * O chalé tem 3 suítes, então aceita até 3 entradas ao mesmo tempo — entradas
 * em sequência (ou com troca no mesmo dia) não disputam suíte e são livres.
 */
function ensureSuitesAvailable(
  stay: StayPeriod,
  activeStays: Reservation[],
  excludeId?: string,
): void {
  const concurrent = activeStays.filter(
    (other) => other.id !== excludeId && staysOverlap(stay, other),
  ).length;
  if (concurrent >= SUITES_PER_CHALET) {
    throw new ConflictError(
      `Chalé lotado neste período: já há ${SUITES_PER_CHALET} entradas simultâneas (uma por suíte).`,
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

    const activeStays =
      await this.reservationRepository.listActiveByEventAndChalet(
        input.eventId,
        input.chaletId,
      );
    ensureSuitesAvailable(
      { checkIn: input.checkIn, checkOut: input.checkOut },
      activeStays,
    );

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
    ensureCanManage(user);

    const event = await this.eventRepository.findById(reservation.eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    ensureEventOpen(event);
    const checkIn = input.checkIn ?? reservation.checkIn;
    const checkOut = input.checkOut ?? reservation.checkOut;
    ensureStayWithinEvent(event, checkIn, checkOut);

    const activeStays =
      await this.reservationRepository.listActiveByEventAndChalet(
        reservation.eventId,
        reservation.chaletId,
      );
    ensureSuitesAvailable({ checkIn, checkOut }, activeStays, reservation.id);

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
    ensureCanManage(user);

    const event = await this.eventRepository.findById(reservation.eventId);
    if (event) {
      ensureEventOpen(event);
    }

    const cancelled = await this.reservationRepository.cancel(id);
    return toReservationResponse(cancelled);
  }
}

@Injectable()
export class DeleteReservationUseCase {
  constructor(
    private readonly reservationRepository: ReservationRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const reservation = await this.reservationRepository.findById(id);
    if (!reservation) {
      throw new NotFoundError('Reserva não encontrada.');
    }
    await this.reservationRepository.delete(id);
  }
}

@Injectable()
export class ListReservationsUseCase {
  constructor(private readonly reservationRepository: ReservationRepository) {}

  async execute(
    filter: ListReservationsFilter,
    user: AuthenticatedUser,
  ): Promise<ReservationResponse[]> {
    // Proprietário e Admin vêem todas as reservas (visão geral).
    const effectiveFilter = filter;
    const reservations = await this.reservationRepository.list(effectiveFilter);
    return reservations.map(toReservationResponse);
  }
}
