"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { EventStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EventStatusBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useSession } from "@/stores/session";
import { PurchasesTab } from "./tabs/purchases-tab";
import { ReportTab } from "./tabs/report-tab";
import { EventReservationsTab } from "./tabs/reservations-tab";
import { PaymentsTab } from "./tabs/payments-tab";
import { SettlementTab } from "./tabs/settlement-tab";

interface EventDetail {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
}

const TABS = [
  { id: "reservas", label: "Reservas" },
  { id: "compras", label: "Compras" },
  { id: "rateio", label: "Rateio" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "relatorio", label: "Relatório" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const isTabId = (value: string | null): value is TabId =>
  TABS.some((t) => t.id === value);

export default function EventDetailClient() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const requestedTab = searchParams.get("tab");
  const tab: TabId = isTabId(requestedTab) ? requestedTab : "reservas";
  const setTab = (next: TabId) =>
    router.replace(`/eventos/${id}?tab=${next}`, { scroll: false });
  const [confirmClose, setConfirmClose] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: event, isLoading, error } = useQuery({
    queryKey: ["event", id],
    queryFn: () => api<EventDetail>(`/events/${id}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["event", id] });
    void queryClient.invalidateQueries({ queryKey: ["events"] });
    void queryClient.invalidateQueries({ queryKey: ["settlement", id] });
  };

  const closeMutation = useMutation({
    mutationFn: () => api<EventDetail>(`/events/${id}/close`, { method: "POST" }),
    onSuccess: () => {
      invalidate();
      setConfirmClose(false);
    },
    onError: (err: Error) => {
      setConfirmClose(false);
      setActionError(err.message);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => api<EventDetail>(`/events/${id}/reopen`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (err: Error) => setActionError(err.message),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!event) return null;

  const isOpen = event.status === "OPEN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-bold text-ink">{event.name}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDate(event.startDate)} – {formatDate(event.endDate)}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            {isOpen ? (
              <Button variant="destructive" onClick={() => setConfirmClose(true)}>
                Encerrar evento
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => reopenMutation.mutate()}
                loading={reopenMutation.isPending}
              >
                Reabrir evento
              </Button>
            )}
          </div>
        )}
      </div>

      {actionError && <ErrorState message={actionError} />}

      <div className="border-b border-hairline" role="tablist" aria-label="Seções do evento">
        {/* Quebra linha em vez de rolar de lado: com overflow-x as abas finais
            ("Pagamentos", "Relatório") ficavam escondidas no celular sem nenhuma
            pista de que existiam. Acima de 1024px as 5 cabem numa linha só. */}
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted hover:text-ink cursor-pointer sm:px-4",
                tab === t.id && "border-ink text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "reservas" && <EventReservationsTab eventId={event.id} eventOpen={isOpen} />}
      {tab === "compras" && <PurchasesTab eventId={event.id} eventOpen={isOpen} />}
      {tab === "rateio" && <SettlementTab eventId={event.id} eventOpen={isOpen} isAdmin={isAdmin} />}
      {tab === "pagamentos" && <PaymentsTab eventId={event.id} isAdmin={isAdmin} />}
      {tab === "relatorio" && <ReportTab eventId={event.id} />}

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => closeMutation.mutate()}
        title="Encerrar evento"
        description="Ao encerrar, o rateio é congelado e reservas e compras ficam bloqueadas. Somente um administrador poderá reabrir."
        confirmLabel="Encerrar"
        destructive
        loading={closeMutation.isPending}
      />
    </div>
  );
}
