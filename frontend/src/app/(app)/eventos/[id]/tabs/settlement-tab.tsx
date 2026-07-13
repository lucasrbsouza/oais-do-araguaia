"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";
import type {
  Settlement,
  SettlementAutoConfig,
  SettlementAutoMode,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";

const MODE_LABELS: Record<SettlementAutoMode, string> = {
  MANUAL: "Manual",
  ON_PURCHASE: "A cada compra",
  INTERVAL: "A cada intervalo de tempo",
};

/** Configuração do rateio automático — visível apenas para administradores. */
function AutoSettlementCard({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<SettlementAutoMode>("MANUAL");
  const [minutes, setMinutes] = useState("60");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["settlement-auto", eventId],
    queryFn: () =>
      api<SettlementAutoConfig>(`/events/${eventId}/settlement/auto`),
  });

  useEffect(() => {
    if (!config) return;
    setMode(config.mode);
    if (config.intervalMinutes) setMinutes(String(config.intervalMinutes));
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api<SettlementAutoConfig>(`/events/${eventId}/settlement/auto`, {
        method: "PUT",
        body: {
          mode,
          ...(mode === "INTERVAL" ? { intervalMinutes: Number(minutes) } : {}),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["settlement-auto", eventId],
      });
      setSaved(true);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const OPTIONS: Array<{
    value: SettlementAutoMode;
    label: string;
    hint: string;
  }> = [
    {
      value: "MANUAL",
      label: "Manual",
      hint: "O rateio só muda quando você clica em Calcular rateio.",
    },
    {
      value: "ON_PURCHASE",
      label: "A cada compra",
      hint: "Recalcula automaticamente sempre que uma compra é lançada, alterada ou excluída.",
    },
    {
      value: "INTERVAL",
      label: "A cada intervalo de tempo",
      hint: "Recalcula automaticamente no intervalo definido, enquanto o evento estiver aberto.",
    },
  ];

  if (isLoading) return null;

  const currentLabel = config ? MODE_LABELS[config.mode] : "";
  const currentSuffix =
    config?.mode === "INTERVAL" && config.intervalMinutes
      ? ` · ${config.intervalMinutes} min`
      : "";

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full cursor-pointer items-center justify-between gap-3 p-6 text-left hover:bg-surface-soft/60"
      >
        <span>
          <CardTitle>Rateio automático</CardTitle>
          <span className="mt-0.5 block text-sm text-muted">
            {expanded
              ? "Escolha como o rateio deste evento é recalculado. Somente administradores veem esta opção."
              : `Modo atual: ${currentLabel}${currentSuffix}`}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {expanded && (
        <div className="border-t border-hairline px-6 pb-6">
          <div className="mt-4 space-y-3">
            {OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-3 rounded-sm border border-hairline p-3 hover:bg-surface-soft has-checked:border-primary"
              >
                <input
                  type="radio"
                  name="settlement-auto-mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => {
                    setMode(opt.value);
                    setSaved(false);
                  }}
                  className="mt-0.5 size-4 accent-primary cursor-pointer"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">
                    {opt.label}
                  </span>
                  <span className="block text-xs text-muted">{opt.hint}</span>
                  {opt.value === "INTERVAL" && mode === "INTERVAL" && (
                    <span className="mt-2 flex items-center gap-2 text-sm text-ink">
                      A cada
                      <input
                        type="number"
                        min={1}
                        max={10080}
                        value={minutes}
                        onChange={(e) => {
                          setMinutes(e.target.value);
                          setSaved(false);
                        }}
                        className="h-11 w-24 rounded-sm border border-hairline bg-canvas px-2 text-base sm:h-8 sm:text-sm"
                      />
                      minutos
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
          {saveError && (
            <div className="mt-3">
              <ErrorState message={saveError} />
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-3">
            {saved && (
              <span className="text-sm text-success">Configuração salva.</span>
            )}
            <Button
              size="sm"
              loading={saveMutation.isPending}
              disabled={
                mode === "INTERVAL" && (!minutes || Number(minutes) < 1)
              }
              onClick={() => {
                setSaveError(null);
                saveMutation.mutate();
              }}
            >
              Salvar configuração
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function SettlementTab({
  eventId,
  eventOpen,
  isAdmin,
}: {
  eventId: string;
  eventOpen: boolean;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["settlement", eventId],
    queryFn: () => api<Settlement>(`/events/${eventId}/settlement`),
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const calculateMutation = useMutation({
    mutationFn: () =>
      api<Settlement>(`/events/${eventId}/settlement/calculate`, {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settlement", eventId] });
      // Créditos (contas a receber) são regenerados a cada rateio.
      void queryClient.invalidateQueries({
        queryKey: ["receivables", eventId],
      });
      void queryClient.invalidateQueries({ queryKey: ["payments", eventId] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  if (isLoading) return <TableSkeleton />;

  const notCalculated = error instanceof ApiError && error.status === 404;
  if (error && !notCalculated)
    return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-4">
      {isAdmin && eventOpen && (
        <div className="flex justify-end">
          <Button
            onClick={() => calculateMutation.mutate()}
            loading={calculateMutation.isPending}
          >
            {data ? "Recalcular rateio" : "Calcular rateio"}
          </Button>
        </div>
      )}
      {actionError && <ErrorState message={actionError} />}

      {isAdmin && eventOpen && <AutoSettlementCard eventId={eventId} />}

      {!data ? (
        <EmptyState
          title="Rateio ainda não calculado"
          description={
            isAdmin
              ? "Lance as compras e reservas e clique em Calcular rateio."
              : "Aguarde o administrador calcular o rateio."
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="py-4">
              <p className="text-sm text-muted">Despesas comuns</p>
              <p className="text-xl font-bold text-ink">
                {formatCents(data.commonTotalCents)}
              </p>
            </Card>
            <Card className="py-4">
              <p className="text-sm text-muted">Bebidas alcoólicas</p>
              <p className="text-xl font-bold text-ink">
                {formatCents(data.alcoholTotalCents)}
              </p>
            </Card>
            <Card className="py-4">
              <p className="text-sm text-muted">Total</p>
              <p className="text-xl font-bold text-primary">
                {formatCents(data.totalCents)}
              </p>
            </Card>
          </div>

          <Table>
            <thead>
              <tr>
                <Th>Chalé</Th>
                <Th className="text-right">Comum</Th>
                <Th className="text-right">Álcool</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.chaletId}>
                  <Td label="Chalé" className="font-medium text-ink">
                    {item.chaletNumber} — {item.chaletName}
                  </Td>
                  <Td label="Comum" className="text-right">
                    {formatCents(item.commonCents)}
                  </Td>
                  <Td label="Álcool" className="text-right">
                    {formatCents(item.alcoholCents)}
                  </Td>
                  <Td label="Total" className="text-right font-semibold text-ink">
                    {formatCents(item.totalCents)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-xs text-muted">
            Regra: despesas comuns por peso (adulto 1,0 · criança 0,5); bebidas
            alcoólicas divididas apenas entre quem consome. Calculado em{" "}
            {new Date(data.computedAt).toLocaleString("pt-BR")}.
          </p>
        </>
      )}
    </div>
  );
}
