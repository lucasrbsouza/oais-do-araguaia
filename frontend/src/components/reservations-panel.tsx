"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDate, nightsBetween } from "@/lib/format";
import type { Reservation } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { ReservationForm } from "@/components/reservation-form";
import { useSession } from "@/stores/session";

interface ReservationsPanelProps {
  /** Restringe às reservas de um evento (aba do evento). */
  eventId?: string;
  /** Esconde ações de escrita quando o evento está encerrado. */
  eventOpen?: boolean;
}

/**
 * Painel único de reservas usado tanto na página Reservas quanto na aba
 * do evento: mesmas colunas, mesmas ações e mesmas regras nas duas telas.
 * Editar, cancelar e excluir são exclusivos do administrador.
 */
export function ReservationsPanel({ eventId, eventOpen = true }: ReservationsPanelProps) {
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Reservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filterMyReservations, setFilterMyReservations] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: eventId ? ["reservations", eventId] : ["reservations"],
    queryFn: () =>
      api<Reservation[]>(eventId ? `/reservations?eventId=${eventId}` : "/reservations"),
  });

  const filteredReservations = useMemo(() => {
    if (!data) return [];
    if (!filterMyReservations) return data;
    return data.filter(
      (r) => r.responsible.id === user?.id || r.chalet.ownerId === user?.id
    );
  }, [data, filterMyReservations, user?.id]);

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      api<Reservation>(`/reservations/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      setCancelTarget(null);
    },
    onError: (err: Error) => {
      setCancelTarget(null);
      setActionError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/reservations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      setActionError(err.message);
    },
  });

  if (isLoading) return <TableSkeleton rows={6} />;
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-4">
      {eventOpen && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setActionError(null);
              setCreateOpen(true);
            }}
          >
            Nova reserva
          </Button>
        </div>
      )}

      {actionError && <ErrorState message={actionError} />}

      {data && data.length > 0 && (
        <div className="flex items-center gap-2 bg-surface-soft p-3 rounded-md border border-hairline max-w-xs">
          <input
            type="checkbox"
            id="filter-my-reservations"
            checked={filterMyReservations}
            onChange={(e) => setFilterMyReservations(e.target.checked)}
            className="rounded-xs border-hairline text-primary focus:ring-primary size-4 accent-primary cursor-pointer"
          />
          <label htmlFor="filter-my-reservations" className="text-sm text-ink font-medium select-none cursor-pointer">
            Minhas reservas
          </label>
        </div>
      )}

      {!data || data.length === 0 ? (
        <EmptyState
          title={eventId ? "Nenhuma reserva neste evento" : "Nenhuma reserva"}
          description="Crie a primeira reserva de um chalé."
        />
      ) : filteredReservations.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center border border-hairline border-dashed rounded-md bg-canvas gap-3">
          <p className="text-sm text-muted">Nenhuma reserva atende a este filtro.</p>
          {filterMyReservations && (
            <Button variant="secondary" size="xs" onClick={() => setFilterMyReservations(false)}>
              Ver todas as reservas
            </Button>
          )}
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Chalé</Th>
              <Th>Responsável</Th>
              <Th>Período</Th>
              <Th>Diárias</Th>
              <Th>Adultos</Th>
              <Th>Crianças</Th>
              <Th>Álcool</Th>
              <Th>Status</Th>
              <Th className="w-36">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filteredReservations.map((r) => {
              const isMyReservation = r.responsible.id === user?.id || r.chalet.ownerId === user?.id;
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "hover:bg-surface-soft/60",
                    isMyReservation && "bg-primary/[0.04] border-l-2 border-l-primary"
                  )}
                >
                  <Td label="Chalé" className="font-medium text-ink">
                    {r.chalet.number} — {r.chalet.name}
                  </Td>
                  <Td label="Responsável">
                    <span className="flex items-center gap-1.5">
                      {r.responsible.name}
                      {r.responsible.id === user?.id && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Você
                        </span>
                      )}
                    </span>
                  </Td>
                  <Td label="Período">
                    {formatDate(r.checkIn)} – {formatDate(r.checkOut)}
                  </Td>
                  <Td label="Diárias">{nightsBetween(r.checkIn, r.checkOut)}</Td>
                  <Td label="Adultos">{r.adults}</Td>
                  <Td label="Crianças">{r.children}</Td>
                  <Td label="Álcool">{r.alcoholConsumers}</Td>
                  <Td label="Status">
                    <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"}>
                      {r.status === "ACTIVE" ? "Ativa" : "Cancelada"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1 xl:flex-nowrap">
                      {r.status === "ACTIVE" && eventOpen && isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setActionError(null);
                              setEditTarget(r);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="text-error"
                            onClick={() => {
                              setActionError(null);
                              setCancelTarget(r);
                            }}
                          >
                            Cancelar
                          </Button>
                        </>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-error"
                          onClick={() => {
                            setActionError(null);
                            setDeleteTarget(r);
                          }}
                        >
                          Excluir
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Nova reserva">
        <ReservationForm defaultEventId={eventId} onDone={() => setCreateOpen(false)} />
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Editar reserva"
      >
        {editTarget && (
          <ReservationForm reservation={editTarget} onDone={() => setEditTarget(null)} />
        )}
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Excluir reserva"
        description={
          deleteTarget
            ? `Excluir permanentemente a reserva do Chalé ${deleteTarget.chalet.number} (${formatDate(deleteTarget.checkIn)} – ${formatDate(deleteTarget.checkOut)})? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir reserva"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
