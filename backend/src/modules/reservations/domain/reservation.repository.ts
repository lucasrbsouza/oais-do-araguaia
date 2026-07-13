import { Chalet, Reservation, User } from '@prisma/client';

export type ReservationDetail = Reservation & {
  chalet: Chalet;
  responsible: User;
};

export interface CreateReservationData {
  eventId: string;
  chaletId: string;
  responsibleId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  alcoholConsumers: number;
  notes?: string;
}

export interface UpdateReservationData {
  checkIn?: Date;
  checkOut?: Date;
  adults?: number;
  children?: number;
  alcoholConsumers?: number;
  notes?: string;
}

export interface ListReservationsFilter {
  eventId?: string;
  chaletId?: string;
  responsibleId?: string;
  /** Restringe às reservas de chalés deste proprietário (perfil OWNER). */
  chaletOwnerId?: string;
  from?: Date;
  to?: Date;
}

export abstract class ReservationRepository {
  abstract findById(id: string): Promise<ReservationDetail | null>;
  abstract findActiveByEventAndChalet(
    eventId: string,
    chaletId: string,
  ): Promise<Reservation | null>;
  abstract create(data: CreateReservationData): Promise<ReservationDetail>;
  abstract update(
    id: string,
    data: UpdateReservationData,
  ): Promise<ReservationDetail>;
  abstract cancel(id: string): Promise<ReservationDetail>;
  abstract delete(id: string): Promise<void>;
  abstract list(filter: ListReservationsFilter): Promise<ReservationDetail[]>;
}
