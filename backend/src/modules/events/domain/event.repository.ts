import { Event, EventStatus } from '@prisma/client';
import { SettlementShare } from '../../settlement/domain/expense-sharing.strategy';

export interface CreateEventData {
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface ListEventsFilter {
  from?: Date;
  to?: Date;
  status?: EventStatus;
  page: number;
  perPage: number;
}

export interface EventSummary extends Event {
  reservationCount: number;
  purchaseTotalCents: number;
  hasSettlement: boolean;
}

export interface PaginatedEvents {
  data: EventSummary[];
  total: number;
  page: number;
  perPage: number;
}

export abstract class EventRepository {
  abstract findById(id: string): Promise<Event | null>;
  abstract create(data: CreateEventData): Promise<Event>;
  abstract update(id: string, data: Partial<CreateEventData>): Promise<Event>;
  abstract list(filter: ListEventsFilter): Promise<PaginatedEvents>;
  abstract findOverlapping(
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ): Promise<Event[]>;
  abstract closeWithSettlement(
    eventId: string,
    strategy: string,
    shares: SettlementShare[],
    closedById: string,
  ): Promise<Event>;
  abstract reopen(eventId: string): Promise<Event>;
  abstract cancel(eventId: string): Promise<Event>;
  abstract hasActivity(eventId: string): Promise<boolean>;
  abstract delete(eventId: string): Promise<void>;
}
