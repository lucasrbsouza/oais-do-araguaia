"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatCents, formatDate } from "@/lib/format";
import type { EventItem, Paginated } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EventStatusBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";

/**
 * Atalho do menu lateral: a pessoa escolhe o evento e cai direto na aba
 * de Compras dele. Cards (e não tabela) de propósito, para não parecer
 * a tela de Eventos — aqui só se escolhe, não se gerencia evento.
 */
export default function EventPurchasesShortcutPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", page],
    queryFn: () => api<Paginated<EventItem>>(`/events?page=${page}&perPage=20`),
  });

  if (isLoading) return <TableSkeleton rows={6} />;
  if (error) return <ErrorState message={(error as Error).message} />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ShoppingCart className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink">Compras por evento</h1>
          <p className="text-sm text-muted">
            Escolha o evento para ver e lançar as compras dele.
          </p>
        </div>
      </div>

      {data?.data.length === 0 ? (
        <EmptyState
          title="Nenhum evento cadastrado"
          description="Crie um evento na tela de Eventos para começar."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((event) => (
            <Link
              key={event.id}
              href={`/eventos/${event.id}?tab=compras`}
              className="group flex flex-col rounded-md border border-hairline bg-canvas p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-ink">{event.name}</h2>
                <EventStatusBadge status={event.status} />
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <CalendarDays className="size-3.5" aria-hidden />
                {formatDate(event.startDate)} – {formatDate(event.endDate)}
              </p>
              <div className="mt-5 flex items-end justify-between border-t border-hairline pt-4">
                <div>
                  <p className="text-xs text-muted">Total em compras</p>
                  <p className="text-xl font-bold text-ink">
                    {formatCents(event.purchaseTotalCents)}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-sm font-medium text-primary">
                  Ver compras
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </div>
            </Link>
          ))}
        </div>
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
    </div>
  );
}
