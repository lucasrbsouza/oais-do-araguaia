import { Injectable } from '@nestjs/common';
import { Event, EventStatus } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { DateRange } from '../../../../shared/domain/date-range';
import { Money } from '../../../../shared/domain/money';
import { AuditService } from '../../../audit/audit.service';
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
    private readonly auditService: AuditService,
  ) {}

  async execute(eventId: string, closedById: string): Promise<Event> {
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }
    if (event.status === EventStatus.CLOSED) {
      throw new ConflictError('Evento já está encerrado.');
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
    await this.auditService.log({
      userId: closedById,
      action: 'EVENT_CLOSED',
      entity: 'Event',
      entityId: eventId,
    });
    return closed;
  }
}

@Injectable()
export class ReopenEventUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly auditService: AuditService,
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
    await this.auditService.log({
      userId: reopenedById,
      action: 'EVENT_REOPENED',
      entity: 'Event',
      entityId: eventId,
    });
    return reopened;
  }
}
