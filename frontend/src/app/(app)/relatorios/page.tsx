"use client";

import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { api, downloadFile, IS_DEMO } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { EventItem, Paginated, ReservationsReport } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EventStatusBadge } from "@/components/ui/badge";
import { SelectField } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";

export default function RelatoriosPage() {
  const [eventId, setEventId] = useState("");
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: events, isLoading: loadingEvents } = useQuery({
    queryKey: ["events", "todos"],
    queryFn: () => api<Paginated<EventItem>>("/events?page=1&perPage=100"),
  });

  // Sem escolha explícita, abre no evento mais recente: é o que a
  // administração quer ver em 9 de cada 10 acessos.
  const selectedId = eventId || (events?.data[0]?.id ?? "");

  const { data, isLoading, error } = useQuery({
    queryKey: ["relatorio-reservas", selectedId],
    queryFn: () => api<ReservationsReport>(`/reports/events/${selectedId}/reservations`),
    enabled: selectedId !== "",
  });

  const handleExport = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    setExportError(null);
    try {
      await downloadFile(
        `/reports/events/${selectedId}/reservations/export/${format}`,
        `reservas.${format}`,
      );
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(null);
    }
  };

  const stats = data && [
    { label: "Adultos", value: data.totals.adults },
    { label: "Crianças", value: data.totals.children },
    { label: "Consomem álcool", value: data.totals.alcoholConsumers },
    { label: "Total de pessoas", value: data.totals.totalPeople },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Relatórios</h1>

      <Card>
        <CardTitle>Relatório geral de reservas</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Quantas pessoas ficaram em cada chalé no evento, com adultos, crianças e
          consumidores de bebida alcoólica.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <SelectField
              label="Evento"
              value={selectedId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={loadingEvents}
            >
              {events?.data.length === 0 && <option value="">Nenhum evento cadastrado</option>}
              {events?.data.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} — {formatDate(ev.startDate)}
                </option>
              ))}
            </SelectField>
          </div>

          {!IS_DEMO && selectedId !== "" && (
            <div className="flex flex-wrap gap-2">
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
        </div>
      </Card>

      {exportError && <ErrorState message={exportError} />}

      {selectedId === "" && !loadingEvents && (
        <EmptyState title="Cadastre um evento para gerar o relatório" />
      )}
      {isLoading && selectedId !== "" && <TableSkeleton />}
      {error && <ErrorState message={(error as Error).message} />}

      {data && stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="py-4">
                <p className="text-sm text-muted">{stat.label}</p>
                <p className="text-2xl font-bold text-ink">{stat.value}</p>
              </Card>
            ))}
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{data.event.name}</CardTitle>
              <EventStatusBadge status={data.event.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {formatDate(data.event.startDate)} – {formatDate(data.event.endDate)} •{" "}
              {data.totals.chaletsOccupied} de {data.chalets.length} chalés ocupados •{" "}
              {data.totals.reservations} reserva(s)
            </p>

            <div className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Chalé</Th>
                    <Th>Proprietário / Responsável</Th>
                    <Th>Período</Th>
                    <Th className="text-right">Diárias</Th>
                    <Th className="text-right">Adultos</Th>
                    <Th className="text-right">Crianças</Th>
                    <Th className="text-right">Álcool</Th>
                    <Th className="text-right">Pessoas</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.chalets.map((chalet) => (
                    <LinhasDoChale key={chalet.chaletId} chalet={chalet} />
                  ))}
                  <tr className="bg-surface-soft font-semibold text-ink">
                    <Td label="Chalé">Total geral</Td>
                    <Td className="somente-tabela" />
                    <Td className="somente-tabela" />
                    <Td className="somente-tabela" />
                    <Td label="Adultos" className="text-right">
                      {data.totals.adults}
                    </Td>
                    <Td label="Crianças" className="text-right">
                      {data.totals.children}
                    </Td>
                    <Td label="Álcool" className="text-right">
                      {data.totals.alcoholConsumers}
                    </Td>
                    <Td label="Pessoas" className="text-right">
                      {data.totals.totalPeople}
                    </Td>
                  </tr>
                </tbody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/** Linha do chalé com o total e, abaixo, cada reserva que formou esse total. */
function LinhasDoChale({ chalet }: { chalet: ReservationsReport["chalets"][number] }) {
  const semReserva = chalet.reservations.length === 0;

  return (
    <>
      <tr className="bg-surface-soft">
        <Td label="Chalé" className="font-semibold text-ink">
          {chalet.chaletNumber} — {chalet.chaletName}
        </Td>
        <Td label="Proprietário">
          {chalet.ownerName ?? <span className="text-muted-soft">Sem proprietário</span>}
        </Td>
        {/* Só vira cartão no celular quando tem o que dizer; vazia, some. */}
        {semReserva ? (
          <Td label="Situação" className="text-muted-soft">
            Sem reserva
          </Td>
        ) : (
          <Td className="somente-tabela" />
        )}
        <Td className="somente-tabela" />
        <Td label="Adultos" className="text-right font-semibold">
          {chalet.adults}
        </Td>
        <Td label="Crianças" className="text-right font-semibold">
          {chalet.children}
        </Td>
        <Td label="Álcool" className="text-right font-semibold">
          {chalet.alcoholConsumers}
        </Td>
        <Td label="Pessoas" className="text-right font-semibold">
          {chalet.totalPeople}
        </Td>
      </tr>

      {chalet.reservations.map((r) => (
        <tr key={r.id}>
          {/* No celular cada linha vira um cartão solto: sem repetir o chalé,
              não dá para saber de quem é a reserva. Na tabela a coluna já
              está preenchida na linha do chalé, logo fica vazia. */}
          <Td label="Chalé">
            <span className="xl:hidden">
              {chalet.chaletNumber} — {chalet.chaletName}
            </span>
          </Td>
          <Td label="Responsável" className="xl:pl-8">
            {r.responsibleName}
          </Td>
          <Td label="Período">
            {formatDate(r.checkIn)} – {formatDate(r.checkOut)}
          </Td>
          <Td label="Diárias" className="text-right">
            {r.nights}
          </Td>
          <Td label="Adultos" className="text-right">
            {r.adults}
          </Td>
          <Td label="Crianças" className="text-right">
            {r.children}
          </Td>
          <Td label="Álcool" className="text-right">
            {r.alcoholConsumers}
          </Td>
          <Td label="Pessoas" className="text-right">
            {r.totalPeople}
          </Td>
        </tr>
      ))}
    </>
  );
}
