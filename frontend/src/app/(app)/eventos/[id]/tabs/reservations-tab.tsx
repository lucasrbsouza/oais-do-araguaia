"use client";

import { ReservationsPanel } from "@/components/reservations-panel";

export function EventReservationsTab({
  eventId,
  eventOpen,
}: {
  eventId: string;
  eventOpen: boolean;
}) {
  return <ReservationsPanel eventId={eventId} eventOpen={eventOpen} />;
}
