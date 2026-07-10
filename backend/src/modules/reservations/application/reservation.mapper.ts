import { ReservationDetail } from '../domain/reservation.repository';

export interface ReservationResponse {
  id: string;
  eventId: string;
  chalet: { id: string; number: number; name: string; ownerId: string | null };
  responsible: { id: string; name: string };
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  alcoholConsumers: number;
  notes: string | null;
  status: string;
}

export const toReservationResponse = (
  reservation: ReservationDetail,
): ReservationResponse => ({
  id: reservation.id,
  eventId: reservation.eventId,
  chalet: {
    id: reservation.chalet.id,
    number: reservation.chalet.number,
    name: reservation.chalet.name,
    ownerId: reservation.chalet.ownerId,
  },
  responsible: {
    id: reservation.responsible.id,
    name: reservation.responsible.name,
  },
  checkIn: reservation.checkIn,
  checkOut: reservation.checkOut,
  adults: reservation.adults,
  children: reservation.children,
  alcoholConsumers: reservation.alcoholConsumers,
  notes: reservation.notes,
  status: reservation.status,
});
