import { Injectable } from '@nestjs/common';
import { Event, EventStatus } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { DateRange } from '../../../../shared/domain/date-range';
import { Money } from '../../../../shared/domain/money';
import { ExpenseSharingStrategy } from '../../../settlement/domain/expense-sharing.strategy';
import { SettlementRepository } from '../../../settlement/domain/settlement.repository';
import {
  EventRepository,
  ListEventsFilter,
  PaginatedEvents,
} from '../../domain/event.repository';

export interface CreateEventInput {
  name: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class CreateEventUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(input: CreateEventInput): Promise<Event> {
    DateRange.create(input.startDate, input.endDate);
    const overlapping = await this.eventRepository.findOverlapping(
      input.startDate,
      input.endDate,
    );
    if (overlapping.length > 0) {
      throw new ConflictError(
        `Já existe o evento "${overlapping[0].name}" neste período.`,
      );
    }
    return this.eventRepository.create(input);
  }
}

export interface UpdateEventInput {
  id: string;
  name?: string;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class UpdateEventUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(input: UpdateEventInput): Promise<Event> {
    const event = await this.eventRepository.findById(input.id);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    if (event.status === EventStatus.CLOSED) {
      throw new ConflictError(
        'Evento encerrado não pode ser editado. Reabra-o primeiro.',
      );
    }

    const startDate = input.startDate ?? event.startDate;
    const endDate = input.endDate ?? event.endDate;
    DateRange.create(startDate, endDate);

    if (input.startDate || input.endDate) {
      const overlapping = await this.eventRepository.findOverlapping(
        startDate,
        endDate,
        input.id,
      );
      if (overlapping.length > 0) {
        throw new ConflictError(
          `Já existe o evento "${overlapping[0].name}" neste período.`,
        );
      }
    }

    return this.eventRepository.update(input.id, {
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
    });
  }
}

@Injectable()
export class CancelEventUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
  ) {}

  async execute(eventId: string, cancelledById: string): Promise<Event> {
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    if (event.status === EventStatus.CLOSED) {
      throw new ConflictError(
        'Evento encerrado não pode ser cancelado. Reabra-o primeiro.',
      );
    }
    if (event.status === EventStatus.CANCELLED) {
      throw new ConflictError('Evento já está cancelado.');
    }

    const cancelled = await this.eventRepository.cancel(eventId);
    return cancelled;
  }
}

@Injectable()
export class DeleteEventUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
  ) {}

  async execute(eventId: string, deletedById: string): Promise<void> {
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    const hasActivity = await this.eventRepository.hasActivity(eventId);
    if (hasActivity) {
      throw new ConflictError(
        'Este evento possui reservas, compras ou pagamentos e não pode ser excluído. Cancele-o em vez disso.',
      );
    }

    await this.eventRepository.delete(eventId);
  }
}

@Injectable()
export class ListEventsUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  execute(filter: ListEventsFilter): Promise<PaginatedEvents> {
    return this.eventRepository.list(filter);
  }
}

@Injectable()
export class GetEventUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(id: string): Promise<Event> {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    return event;
  }
}

@Injectable()
export class CloseEventUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly settlementRepository: SettlementRepository,
    private readonly strategy: ExpenseSharingStrategy,
  ) {}

  async execute(eventId: string, closedById: string): Promise<Event> {
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    if (event.status === EventStatus.CLOSED) {
      throw new ConflictError('Evento já está encerrado.');
    }
    if (event.status === EventStatus.CANCELLED) {
      throw new ConflictError(
        'Evento cancelado não pode ser encerrado. Reabra-o primeiro.',
      );
    }

    const input = await this.settlementRepository.getCalculationInput(eventId);
    if (!input) {
      throw new NotFoundError('Evento não encontrado.');
    }
    const shares = this.strategy.calculate({
      occupancies: input.occupancies,
      commonTotal: Money.fromCents(input.commonTotalCents),
      alcoholTotal: Money.fromCents(input.alcoholTotalCents),
    });

    const closed = await this.eventRepository.closeWithSettlement(
      eventId,
      this.strategy.name,
      shares,
      closedById,
    );
    return closed;
  }
}

@Injectable()
export class ReopenEventUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
  ) {}

  async execute(eventId: string, reopenedById: string): Promise<Event> {
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    if (event.status === EventStatus.OPEN) {
      throw new ConflictError('Evento já está aberto.');
    }

    const reopened = await this.eventRepository.reopen(eventId);
    return reopened;
  }
}
