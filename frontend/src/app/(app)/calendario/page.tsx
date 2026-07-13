"use client";

import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Reservation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/states";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const from = format(startOfMonth(month), "yyyy-MM-dd");
  const to = format(endOfMonth(month), "yyyy-MM-dd");

  const { data: reservations, isLoading, error } = useQuery({
    queryKey: ["reservations", "calendar", from, to],
    queryFn: () => api<Reservation[]>(`/reservations?from=${from}&to=${to}`),
  });

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leadingBlanks = getDay(startOfMonth(month));

  const chaletsOn = (day: Date): number[] =>
    (reservations ?? [])
      .filter(
        (r) =>
          r.status === "ACTIVE" &&
          isWithinInterval(day, { start: parseISO(r.checkIn), end: parseISO(r.checkOut) }),
      )
      .map((r) => r.chalet.number)
      .sort((a, b) => a - b);

  const reservationsForDay = (day: Date): Reservation[] => {
    if (!reservations) return [];
    return reservations.filter(
      (r) =>
        r.status === "ACTIVE" &&
        isWithinInterval(day, { start: parseISO(r.checkIn), end: parseISO(r.checkOut) })
    );
  };

  const ITEMS_PER_PAGE = 3;
  const dayReservations = selectedDay ? reservationsForDay(selectedDay) : [];
  const totalPages = Math.ceil(dayReservations.length / ITEMS_PER_PAGE);
  const paginatedReservations = dayReservations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Calendário</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-base font-semibold capitalize text-ink sm:min-w-40">
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="xs" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {error && <ErrorState message={(error as Error).message} />}
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card className="p-2 sm:p-3 md:p-4">
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase text-muted sm:gap-1 sm:text-xs">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((day) => {
              const chalets = chaletsOn(day);
              const occupied = chalets.length > 0;
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    setSelectedDay(day);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "min-h-16 rounded-sm border border-hairline-soft p-1 cursor-pointer hover:border-primary/40 hover:bg-surface-soft transition-all sm:min-h-20 sm:p-1.5",
                    occupied && "border-primary/40 bg-primary/5 hover:bg-primary/10",
                  )}
                >
                  <span className="text-xs font-medium text-body">{format(day, "d")}</span>
                  {occupied && (
                    <div className="mt-1 flex flex-wrap gap-0.5 sm:gap-1">
                      {chalets.map((n) => (
                        <span
                          key={n}
                          title={`Chalé ${n}`}
                          className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white sm:size-5 sm:text-[10px]"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            Os círculos indicam os chalés reservados no dia.
          </p>
        </Card>
      )}

      <Dialog
        open={selectedDay !== null}
        onClose={() => {
          setSelectedDay(null);
          setCurrentPage(1);
        }}
        title={selectedDay ? `Reservas — ${format(selectedDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}` : ""}
      >
        {selectedDay && (
          <div className="space-y-4">
            {dayReservations.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">Nenhum chalé reservado para este dia.</p>
            ) : (
              <div className="space-y-4">
                <div className="divide-y divide-hairline max-h-96 overflow-y-auto pr-1">
                  {paginatedReservations.map((r) => (
                    <div key={r.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-ink">
                          Chalé {r.chalet.number} — {r.chalet.name}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-0.5 rounded-xs">
                          Ativa
                        </span>
                      </div>
                      <p className="text-sm text-body">
                        <span className="font-semibold text-muted text-xs uppercase tracking-wider">Responsável</span>{" "}
                        <span className="text-ink font-medium">{r.responsible.name}</span>
                      </p>
                      <p className="text-xs text-muted">
                        Período: {formatDate(r.checkIn)} até {formatDate(r.checkOut)}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mt-1 bg-surface-soft p-2 rounded-xs">
                        <span>Adultos: <strong className="text-ink">{r.adults}</strong></span>
                        <span>Crianças: <strong className="text-ink">{r.children}</strong></span>
                        <span>Álcool: <strong className="text-ink">{r.alcoholConsumers}</strong></span>
                      </div>
                      {r.notes && (
                        <p className="text-xs text-body italic mt-1 bg-warning/5 border border-warning/10 p-2 rounded-xs">
                          Obs: {r.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between py-2 border-t border-hairline text-sm">
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-muted font-medium select-none">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-hairline">
              <Button
                onClick={() => {
                  setSelectedDay(null);
                  setCurrentPage(1);
                }}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
