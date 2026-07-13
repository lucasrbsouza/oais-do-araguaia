"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api";
import { formatCents, formatDate } from "@/lib/format";
import type { EventItem, Paginated } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EventStatusBadge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { useSession } from "@/stores/session";

const schema = z
  .object({
    name: z.string().min(2, "Informe o nome do evento."),
    startDate: z.string().min(1, "Informe a data inicial."),
    endDate: z.string().min(1, "Informe a data final."),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Data final deve ser igual ou posterior à inicial.",
    path: ["endDate"],
  });

type FormData = z.infer<typeof schema>;

/** Célula que navega direto para uma aba do evento (reservas, compras, rateio…). */
function TabCell({
  eventId,
  tab,
  label,
  children,
}: {
  eventId: string;
  tab: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Td label={label}>
      <Link
        href={`/eventos/${eventId}?tab=${tab}`}
        onClick={(e) => e.stopPropagation()}
        className="text-body underline-offset-4 hover:text-primary hover:underline"
      >
        {children}
      </Link>
    </Td>
  );
}

export default function EventsPage() {
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EventItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<EventItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", page],
    queryFn: () => api<Paginated<EventItem>>(`/events?page=${page}&perPage=20`),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
    },
  });
  const editForm = useForm<FormData>({ resolver: zodResolver(schema) });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: FormData) => api<EventItem>("/events", { method: "POST", body: payload }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      form.reset({
        name: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
      });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: FormData & { id: string }) =>
      api<EventItem>(`/events/${id}`, { method: "PATCH", body: payload }),
    onSuccess: () => {
      invalidate();
      setEditTarget(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api<EventItem>(`/events/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      invalidate();
      setCancelTarget(null);
    },
    onError: (err: Error) => {
      setCancelTarget(null);
      setListError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      setListError(err.message);
    },
  });

  const openEdit = (event: EventItem): void => {
    setFormError(null);
    editForm.reset({
      name: event.name,
      startDate: event.startDate.slice(0, 10),
      endDate: event.endDate.slice(0, 10),
    });
    setEditTarget(event);
  };

  if (isLoading) return <TableSkeleton rows={6} />;
  if (error) return <ErrorState message={(error as Error).message} />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Eventos</h1>
        {isAdmin && (
          <Button
            onClick={() => {
              form.reset({
                name: "",
                startDate: new Date().toISOString().slice(0, 10),
                endDate: new Date().toISOString().slice(0, 10),
              });
              setOpen(true);
            }}
          >
            Novo evento
          </Button>
        )}
      </div>

      {listError && <ErrorState message={listError} />}

      {data?.data.length === 0 ? (
        <EmptyState
          title="Nenhum evento cadastrado"
          description="Crie o primeiro final de semana para começar."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Evento</Th>
              <Th>Período</Th>
              <Th>Reservas</Th>
              <Th>Compras</Th>
              <Th>Rateio</Th>
              <Th>Status</Th>
              {isAdmin && <Th className="w-52">Ações</Th>}
            </tr>
          </thead>
          <tbody>
            {data?.data.map((event) => (
              <tr
                key={event.id}
                className="cursor-pointer hover:bg-surface-soft/60"
                onClick={() => router.push(`/eventos/${event.id}`)}
              >
                <Td label="Evento">
                  <Link
                    href={`/eventos/${event.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {event.name}
                  </Link>
                </Td>
                <Td label="Período">
                  {formatDate(event.startDate)} – {formatDate(event.endDate)}
                </Td>
                <TabCell eventId={event.id} tab="reservas" label="Reservas">
                  {event.reservationCount}
                </TabCell>
                <TabCell eventId={event.id} tab="compras" label="Compras">
                  {formatCents(event.purchaseTotalCents)}
                </TabCell>
                <TabCell eventId={event.id} tab="rateio" label="Rateio">
                  {event.hasSettlement ? "Calculado" : "Calcular"}
                </TabCell>
                <Td label="Status">
                  <EventStatusBadge status={event.status} />
                </Td>
                {isAdmin && (
                  <Td onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-1 xl:flex-nowrap">
                      {event.status !== "CLOSED" && (
                        <Button variant="ghost" size="xs" onClick={() => openEdit(event)}>
                          Editar
                        </Button>
                      )}
                      {event.status === "OPEN" && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setListError(null);
                            setCancelTarget(event);
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-error"
                        onClick={() => {
                          setListError(null);
                          setDeleteTarget(event);
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 text-sm text-muted">
          <Button variant="ghost" size="xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          Página {page} de {totalPages}
          <Button
            variant="ghost"
            size="xs"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Novo evento">
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((payload) => {
            setFormError(null);
            createMutation.mutate(payload);
          })}
          noValidate
        >
          {formError && <ErrorState message={formError} />}
          <Field
            label="Nome"
            placeholder="Ex.: Final de semana 10–12 de julho"
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Início"
              type="date"
              error={form.formState.errors.startDate?.message}
              {...form.register("startDate")}
            />
            <Field
              label="Fim"
              type="date"
              error={form.formState.errors.endDate?.message}
              {...form.register("endDate")}
            />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Criar
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Editar (admin) */}
      <Dialog
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Editar evento"
      >
        <form
          className="space-y-4"
          onSubmit={editForm.handleSubmit((payload) => {
            if (!editTarget) return;
            setFormError(null);
            updateMutation.mutate({ id: editTarget.id, ...payload });
          })}
          noValidate
        >
          {formError && <ErrorState message={formError} />}
          <Field
            label="Nome"
            error={editForm.formState.errors.name?.message}
            {...editForm.register("name")}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Início"
              type="date"
              error={editForm.formState.errors.startDate?.message}
              {...editForm.register("startDate")}
            />
            <Field
              label="Fim"
              type="date"
              error={editForm.formState.errors.endDate?.message}
              {...editForm.register("endDate")}
            />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Cancelar (admin) */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
        title="Cancelar evento"
        description={
          cancelTarget
            ? `Cancelar o evento "${cancelTarget.name}"? Reservas, compras e rateio ficam bloqueados enquanto o evento estiver cancelado. É possível reabri-lo depois.`
            : ""
        }
        confirmLabel="Cancelar evento"
        destructive
        loading={cancelMutation.isPending}
      />

      {/* Excluir (admin) */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Excluir evento"
        description={
          deleteTarget
            ? `Excluir o evento "${deleteTarget.name}"? Eventos com reservas, compras ou pagamentos não podem ser excluídos. Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
