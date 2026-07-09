"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Reservation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { ReservationForm } from "@/components/reservation-form";

export function EventReservationsTab({
  eventId,
  eventOpen,
}: {
  eventId: string;
  eventOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["reservations", eventId],
    queryFn: () => api<Reservation[]>(`/reservations?eventId=${eventId}`),
  });

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={(error as Error).message} />;

  const active = data?.filter((r) => r.status === "ACTIVE") ?? [];

  return (
    <div className="space-y-4">
      {eventOpen && (
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}>Nova reserva</Button>
        </div>
      )}
      {active.length === 0 ? (
        <EmptyState title="Nenhuma reserva neste evento" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Chalé</Th>
              <Th>Responsável</Th>
              <Th>Período</Th>
              <Th>Adultos</Th>
              <Th>Crianças</Th>
              <Th>Consomem álcool</Th>
            </tr>
          </thead>
          <tbody>
            {active.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium text-ink">
                  {r.chalet.number} — {r.chalet.name}
                </Td>
                <Td>{r.responsible.name}</Td>
                <Td>
                  {formatDate(r.checkIn)} – {formatDate(r.checkOut)}
                </Td>
                <Td>{r.adults}</Td>
                <Td>{r.children}</Td>
                <Td>{r.alcoholConsumers}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Nova reserva">
        <ReservationForm defaultEventId={eventId} onDone={() => setOpen(false)} />
      </Dialog>
    </div>
  );
}
