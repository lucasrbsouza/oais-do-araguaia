"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Reservation } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { ReservationForm } from "@/components/reservation-form";

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data: reservations, isLoading, error } = useQuery({
    queryKey: ["reservations"],
    queryFn: () => api<Reservation[]>("/reservations"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api<Reservation>(`/reservations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setCancelTarget(null);
    },
    onError: (err: Error) => setCancelError(err.message),
  });

  if (isLoading) return <TableSkeleton rows={6} />;
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Reservas</h1>
        <Button onClick={() => setOpen(true)}>Nova reserva</Button>
      </div>

      {cancelError && <ErrorState message={cancelError} />}

      {reservations?.length === 0 ? (
        <EmptyState title="Nenhuma reserva" description="Crie a primeira reserva de um chalé." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Chalé</Th>
              <Th>Responsável</Th>
              <Th>Período</Th>
              <Th>Adultos</Th>
              <Th>Crianças</Th>
              <Th>Álcool</Th>
              <Th>Status</Th>
              <Th className="w-24">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {reservations?.map((r) => (
              <tr key={r.id} className="hover:bg-surface-soft/60">
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
                <Td>
                  <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"}>
                    {r.status === "ACTIVE" ? "Ativa" : "Cancelada"}
                  </Badge>
                </Td>
                <Td>
                  {r.status === "ACTIVE" && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-error"
                      onClick={() => {
                        setCancelError(null);
                        setCancelTarget(r);
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Nova reserva">
        <ReservationForm onDone={() => setOpen(false)} />
      </Dialog>

      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
        title="Cancelar reserva"
        description={
          cancelTarget
            ? `Cancelar a reserva do Chalé ${cancelTarget.chalet.number} (${formatDate(cancelTarget.checkIn)} – ${formatDate(cancelTarget.checkOut)})? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Cancelar reserva"
        destructive
        loading={cancelMutation.isPending}
      />
    </div>
  );
}
