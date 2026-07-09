"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/format";
import type { Settlement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";

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
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const calculateMutation = useMutation({
    mutationFn: () => api<Settlement>(`/events/${eventId}/settlement/calculate`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["settlement", eventId] }),
    onError: (err: Error) => setActionError(err.message),
  });

  if (isLoading) return <TableSkeleton />;

  const notCalculated = error instanceof ApiError && error.status === 404;
  if (error && !notCalculated) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-4">
      {isAdmin && eventOpen && (
        <div className="flex justify-end">
          <Button onClick={() => calculateMutation.mutate()} loading={calculateMutation.isPending}>
            {data ? "Recalcular rateio" : "Calcular rateio"}
          </Button>
        </div>
      )}
      {actionError && <ErrorState message={actionError} />}

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
              <p className="text-xl font-bold text-ink">{formatCents(data.commonTotalCents)}</p>
            </Card>
            <Card className="py-4">
              <p className="text-sm text-muted">Bebidas alcoólicas</p>
              <p className="text-xl font-bold text-ink">{formatCents(data.alcoholTotalCents)}</p>
            </Card>
            <Card className="py-4">
              <p className="text-sm text-muted">Total</p>
              <p className="text-xl font-bold text-primary">{formatCents(data.totalCents)}</p>
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
                  <Td className="font-medium text-ink">
                    {item.chaletNumber} — {item.chaletName}
                  </Td>
                  <Td className="text-right">{formatCents(item.commonCents)}</Td>
                  <Td className="text-right">{formatCents(item.alcoholCents)}</Td>
                  <Td className="text-right font-semibold text-ink">
                    {formatCents(item.totalCents)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-xs text-muted">
            Regra: despesas comuns por peso (adulto 1,0 · criança 0,5); bebidas alcoólicas
            divididas apenas entre quem consome. Calculado em{" "}
            {new Date(data.computedAt).toLocaleString("pt-BR")}.
          </p>
        </>
      )}
    </div>
  );
}
