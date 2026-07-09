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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Calendário</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-base font-semibold capitalize text-ink">
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
        <Card className="p-3 md:p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-muted">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((day) => {
              const chalets = chaletsOn(day);
              const occupied = chalets.length > 0;
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-20 rounded-sm border border-hairline-soft p-1.5",
                    occupied && "border-primary/40 bg-primary/5",
                  )}
                >
                  <span className="text-xs font-medium text-body">{format(day, "d")}</span>
                  {occupied && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {chalets.map((n) => (
                        <span
                          key={n}
                          title={`Chalé ${n}`}
                          className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white"
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
    </div>
  );
}
