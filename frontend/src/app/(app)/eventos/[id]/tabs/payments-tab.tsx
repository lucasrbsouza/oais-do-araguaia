"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { formatCents, formatDate, parseBRLToCents } from "@/lib/format";
import type { ChaletPaymentSummary, Receivable } from "@/lib/types";
import { RECEIVABLE_STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, PaymentStatusBadge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";

const schema = z.object({
  date: z.string().min(1, "Informe a data."),
  amount: z
    .string()
    .min(1, "Informe o valor.")
    .refine((v) => parseBRLToCents(v) > 0, "Valor inválido."),
  notes: z.string().max(300).optional(),
});

type FormData = z.infer<typeof schema>;
type AccountsView = "payable" | "receivable";

export function PaymentsTab({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const [view, setView] = useState<AccountsView>("payable");

  return (
    <div className="space-y-4">
      <div
        className="flex gap-1 overflow-x-auto border-b border-hairline"
        role="tablist"
        aria-label="Contas"
      >
        {(
          [
            ["payable", "Contas a Pagar"],
            ["receivable", "Contas a Receber"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
              view === key
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "payable" ? (
        <PayableView eventId={eventId} isAdmin={isAdmin} />
      ) : (
        <ReceivableView eventId={eventId} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function PayableView({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [payTarget, setPayTarget] = useState<ChaletPaymentSummary | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["payments", eventId],
    queryFn: () => api<ChaletPaymentSummary[]>(`/events/${eventId}/payments`),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const payMutation = useMutation({
    mutationFn: (payload: FormData) =>
      api("/payments", {
        method: "POST",
        body: {
          eventId,
          chaletId: payTarget?.chaletId,
          date: payload.date,
          amountCents: parseBRLToCents(payload.amount),
          notes: payload.notes || undefined,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["receivables", eventId] });
      setPayTarget(null);
      form.reset();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  if (isLoading) return <TableSkeleton />;

  if (error instanceof ApiError && error.status === 404) {
    return (
      <EmptyState
        title="Rateio ainda não calculado"
        description="As contas a pagar ficam disponíveis após o cálculo do rateio."
      />
    );
  }
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Saldo = devido no rateio − pagamentos − compras/adiantamentos vinculados ao chalé.
      </p>
      <Table>
        <thead>
          <tr>
            <Th>Chalé</Th>
            <Th>Proprietário</Th>
            <Th className="text-right">Devido</Th>
            <Th className="text-right">Adiantamentos</Th>
            <Th className="text-right">Pago</Th>
            <Th className="text-right">Saldo</Th>
            <Th>Status</Th>
            <Th>Pagamentos</Th>
            {isAdmin && <Th className="w-32">Ações</Th>}
          </tr>
        </thead>
        <tbody>
          {data?.map((item) => (
            <tr key={item.chaletId}>
              <Td label="Chalé" className="font-medium text-ink">
                {item.chaletNumber} — {item.chaletName}
              </Td>
              <Td label="Proprietário">
                {item.ownerName ?? <span className="text-muted-soft">—</span>}
              </Td>
              <Td label="Devido" className="text-right">{formatCents(item.owedCents)}</Td>
              <Td label="Adiantamentos" className="text-right">
                {formatCents(item.advanceCents)}
              </Td>
              <Td label="Pago" className="text-right">{formatCents(item.paidCents)}</Td>
              <Td
                label="Saldo"
                className={cn(
                  "text-right font-semibold",
                  item.balanceCents > 0 ? "text-error" : "text-success",
                )}
              >
                {item.balanceCents < 0
                  ? `${formatCents(-item.balanceCents)} (crédito)`
                  : formatCents(item.balanceCents)}
              </Td>
              <Td label="Status">
                <PaymentStatusBadge status={item.status} />
              </Td>
              <Td label="Pagamentos">
                {item.payments.length === 0 ? (
                  <span className="text-muted-soft">—</span>
                ) : (
                  <ul className="space-y-0.5 text-xs">
                    {item.payments.map((p) => (
                      <li key={p.id}>
                        {formatDate(p.date)} · {formatCents(p.amountCents)}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </Td>
              {isAdmin && (
                <Td>
                  {item.balanceCents > 0 && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setFormError(null);
                        form.reset({ date: new Date().toISOString().slice(0, 10) });
                        setPayTarget(item);
                      }}
                    >
                      Registrar pagamento
                    </Button>
                  )}
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>

      <Dialog
        open={payTarget !== null}
        onClose={() => setPayTarget(null)}
        title={payTarget ? `Pagamento — Chalé ${payTarget.chaletNumber}` : ""}
      >
        {payTarget && (
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((payload) => {
              setFormError(null);
              payMutation.mutate(payload);
            })}
            noValidate
          >
            {formError && <ErrorState message={formError} />}
            <p className="text-sm text-muted">
              Saldo devedor:{" "}
              <span className="font-semibold text-ink">
                {formatCents(payTarget.balanceCents)}
              </span>
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Data"
                type="date"
                error={form.formState.errors.date?.message}
                {...form.register("date")}
              />
              <Field
                label="Valor (R$)"
                placeholder="0,00"
                inputMode="decimal"
                error={form.formState.errors.amount?.message}
                {...form.register("amount")}
              />
            </div>
            <Field label="Observações" {...form.register("notes")} />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setPayTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={payMutation.isPending}>
                Registrar
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

function ReceivableView({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [settleTarget, setSettleTarget] = useState<Receivable | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["receivables", eventId],
    queryFn: () => api<Receivable[]>(`/events/${eventId}/receivables`),
  });

  const settleMutation = useMutation({
    mutationFn: (id: string) =>
      api<Receivable>(`/receivables/${id}/settle`, { method: "PATCH", body: {} }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["receivables", eventId] });
      setSettleTarget(null);
    },
    onError: (err: Error) => {
      setSettleTarget(null);
      setActionError(err.message);
    },
  });

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={(error as Error).message} />;

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Nenhum crédito a receber"
        description="Créditos são gerados automaticamente a cada cálculo do rateio, quando adiantamentos e pagamentos de um chalé superam o valor devido."
      />
    );
  }

  return (
    <div className="space-y-4">
      {actionError && <ErrorState message={actionError} />}
      <p className="text-sm text-muted">
        Valores que os chalés têm a receber de volta (crédito gerado no fechamento do evento).
      </p>
      <Table>
        <thead>
          <tr>
            <Th>Chalé</Th>
            <Th className="text-right">Valor do crédito</Th>
            <Th>Gerado em</Th>
            <Th>Status</Th>
            <Th>Observações</Th>
            {isAdmin && <Th className="w-40">Ações</Th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id}>
              <Td label="Chalé" className="font-medium text-ink">
                {r.chaletNumber} — {r.chaletName}
              </Td>
              <Td label="Valor do crédito" className="text-right font-semibold text-success">
                {formatCents(r.amountCents)}
              </Td>
              <Td label="Gerado em">{formatDate(r.createdAt)}</Td>
              <Td label="Status">
                <Badge tone={r.status === "SETTLED" ? "success" : "warning"}>
                  {RECEIVABLE_STATUS_LABELS[r.status]}
                </Badge>
              </Td>
              <Td label="Observações">
                {r.settledAt
                  ? `Quitado em ${formatDate(r.settledAt)}${r.notes ? ` · ${r.notes}` : ""}`
                  : (r.notes ?? "—")}
              </Td>
              {isAdmin && (
                <Td>
                  {r.status === "OPEN" && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setActionError(null);
                        setSettleTarget(r);
                      }}
                    >
                      Registrar devolução
                    </Button>
                  )}
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>

      <ConfirmDialog
        open={settleTarget !== null}
        onClose={() => setSettleTarget(null)}
        onConfirm={() => settleTarget && settleMutation.mutate(settleTarget.id)}
        title="Registrar devolução"
        description={
          settleTarget
            ? `Confirmar devolução de ${formatCents(settleTarget.amountCents)} ao chalé ${settleTarget.chaletNumber} — ${settleTarget.chaletName}?`
            : ""
        }
        confirmLabel="Confirmar"
        loading={settleMutation.isPending}
      />
    </div>
  );
}
