"use client";

import { ReservationsPanel } from "@/components/reservations-panel";

export default function ReservationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Reservas</h1>
      <ReservationsPanel />
    </div>
  );
}
