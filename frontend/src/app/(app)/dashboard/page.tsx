"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatCents, formatDate } from "@/lib/format";
import type { DashboardSummary } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/card";
import { EventStatusBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashboardSummary>("/dashboard"),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  const stats = [
    { label: "Chalés", value: data.chalets.total },
    { label: "Livres", value: data.chalets.free },
    { label: "Reservados", value: data.chalets.reserved },
    { label: "Ocupados", value: data.chalets.occupied },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="py-5">
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-ink">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Próximas reservas</CardTitle>
          <div className="mt-4 space-y-3">
            {data.upcomingReservations.length === 0 && (
              <EmptyState title="Nenhuma reserva futura" />
            )}
            {data.upcomingReservations.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-hairline-soft pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    Chalé {r.chaletNumber} — {r.chaletName}
                  </p>
                  <p className="text-xs text-muted">{r.responsibleName}</p>
                </div>
                <p className="text-sm text-body">
                  {formatDate(r.checkIn)} – {formatDate(r.checkOut)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Último evento</CardTitle>
          {!data.lastEvent ? (
            <div className="mt-4">
              <EmptyState title="Nenhum evento cadastrado" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/eventos/${data.lastEvent.id}`}
                  className="font-medium text-ink underline-offset-4 hover:underline"
                >
                  {data.lastEvent.name}
                </Link>
                <EventStatusBadge status={data.lastEvent.status} />
              </div>
              <p className="text-sm text-muted">
                {formatDate(data.lastEvent.startDate)} – {formatDate(data.lastEvent.endDate)}
              </p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted">Total de compras</dt>
                  <dd className="font-semibold text-ink">
                    {formatCents(data.lastEvent.purchaseTotalCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Rateio</dt>
                  <dd className="font-semibold text-ink">
                    {data.lastEvent.settlementTotalCents !== null
                      ? formatCents(data.lastEvent.settlementTotalCents)
                      : "Não calculado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Chalés pendentes</dt>
                  <dd className="font-semibold text-error">{data.lastEvent.pendingChalets}</dd>
                </div>
                <div>
                  <dt className="text-muted">Chalés quitados</dt>
                  <dd className="font-semibold text-success">{data.lastEvent.paidChalets}</dd>
                </div>
              </dl>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
