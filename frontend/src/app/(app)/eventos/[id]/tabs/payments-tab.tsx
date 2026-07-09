"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { formatCents, formatDate, parseBRLToCents } from "@/lib/format";
import type { ChaletPaymentSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
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

export function PaymentsTab({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
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
        description="Os pagamentos ficam disponíveis após o cálculo do rateio."
      />
    );
  }
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-4">
      <Table>
        <thead>
          <tr>
            <Th>Chalé</Th>
            <Th className="text-right">Devido</Th>
            <Th className="text-right">Pago</Th>
            <Th>Status</Th>
            <Th>Pagamentos</Th>
            {isAdmin && <Th className="w-32">Ações</Th>}
          </tr>
        </thead>
        <tbody>
          {data?.map((item) => (
            <tr key={item.chaletId}>
              <Td className="font-medium text-ink">
                {item.chaletNumber} — {item.chaletName}
              </Td>
              <Td className="text-right">{formatCents(item.owedCents)}</Td>
              <Td className="text-right">{formatCents(item.paidCents)}</Td>
              <Td>
                <PaymentStatusBadge status={item.status} />
              </Td>
              <Td>
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
                  {item.status !== "PAID" && (
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
                {formatCents(payTarget.owedCents - payTarget.paidCents)}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="flex justify-end gap-3">
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
