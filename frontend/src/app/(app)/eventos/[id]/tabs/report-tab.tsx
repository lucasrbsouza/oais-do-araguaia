"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { api, downloadFile, IS_DEMO } from "@/lib/api";
import { formatCents } from "@/lib/format";
import type { EventReport } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PaymentStatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";

export function ReportTab({ eventId }: { eventId: string }) {
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["report", eventId],
    queryFn: () => api<EventReport>(`/reports/events/${eventId}`),
  });

  const handleExport = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    setExportError(null);
    try {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const ts = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}-${pad(now.getHours())}h${pad(now.getMinutes())}`;
      await downloadFile(`/reports/events/${eventId}/export/${format}`, `relatorio-${ts}.${format}`);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {!IS_DEMO && (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => void handleExport("xlsx")}
            loading={exporting === "xlsx"}
            disabled={exporting !== null}
          >
            {exporting !== "xlsx" && <FileSpreadsheet className="size-4" aria-hidden />}
            Exportar Excel
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleExport("pdf")}
            loading={exporting === "pdf"}
            disabled={exporting !== null}
          >
            {exporting !== "pdf" && <FileText className="size-4" aria-hidden />}
            Exportar PDF
          </Button>
        </div>
      )}
      {exportError && <ErrorState message={exportError} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="py-4">
          <p className="text-sm text-muted">Adultos</p>
          <p className="text-2xl font-bold text-ink">{data.guests.adults}</p>
        </Card>
        <Card className="py-4">
          <p className="text-sm text-muted">Crianças</p>
          <p className="text-2xl font-bold text-ink">{data.guests.children}</p>
        </Card>
        <Card className="py-4">
          <p className="text-sm text-muted">Consomem álcool</p>
          <p className="text-2xl font-bold text-ink">{data.guests.alcoholConsumers}</p>
        </Card>
        <Card className="py-4">
          <p className="text-sm text-muted">Total gasto</p>
          <p className="text-2xl font-bold text-primary">{formatCents(data.totalCents)}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Despesas por categoria</CardTitle>
        {data.purchasesByCategory.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Nenhuma compra lançada" />
          </div>
        ) : (
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Categoria</Th>
                  <Th className="text-right">Itens</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {data.purchasesByCategory.map((row) => (
                  <tr key={row.category}>
                    <Td className="font-medium text-ink">{CATEGORY_LABELS[row.category]}</Td>
                    <Td className="text-right">{row.count}</Td>
                    <Td className="text-right">{formatCents(row.totalCents)}</Td>
                  </tr>
                ))}
                <tr>
                  <Td className="font-semibold text-ink">Total</Td>
                  <Td />
                  <Td className="text-right font-semibold text-ink">
                    {formatCents(data.totalCents)}
                  </Td>
                </tr>
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Rateio e pagamentos por chalé</CardTitle>
        {!data.settlement ? (
          <div className="mt-4">
            <EmptyState title="Rateio ainda não calculado" />
          </div>
        ) : (
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Chalé</Th>
                  <Th className="text-right">Comum</Th>
                  <Th className="text-right">Álcool</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Adiantado</Th>
                  <Th className="text-right">Pago</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.settlement.map((row) => (
                  <tr key={row.chaletNumber}>
                    <Td className="font-medium text-ink">
                      {row.chaletNumber} — {row.chaletName}
                    </Td>
                    <Td className="text-right">{formatCents(row.commonCents)}</Td>
                    <Td className="text-right">{formatCents(row.alcoholCents)}</Td>
                    <Td className="text-right font-semibold">{formatCents(row.totalCents)}</Td>
                    <Td className="text-right">{formatCents(row.advanceCents)}</Td>
                    <Td className="text-right">{formatCents(row.paidCents)}</Td>
                    <Td>
                      <PaymentStatusBadge status={row.paymentStatus} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
