"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Chalet, EventItem, Paginated, Reservation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";

const schema = z.object({
  eventId: z.string().min(1, "Selecione o evento."),
  chaletId: z.string().min(1, "Selecione o chalé."),
  checkIn: z.string().min(1, "Informe a entrada."),
  checkOut: z.string().min(1, "Informe a saída."),
  adults: z.coerce.number().int().min(0),
  children: z.coerce.number().int().min(0),
  alcoholConsumers: z.coerce.number().int().min(0),
  notes: z.string().max(500).optional(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface ReservationFormProps {
  defaultEventId?: string;
  onDone: () => void;
}

export function ReservationForm({ defaultEventId, onDone }: ReservationFormProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const { data: events } = useQuery({
    queryKey: ["events", "open"],
    queryFn: () => api<Paginated<EventItem>>("/events?status=OPEN&page=1&perPage=50"),
  });
  const { data: chalets } = useQuery({
    queryKey: ["chalets"],
    queryFn: () => api<Chalet[]>("/chalets"),
  });

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      eventId: defaultEventId ?? "",
      adults: 1,
      children: 0,
      alcoholConsumers: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormOutput) =>
      api<Reservation>("/reservations", {
        method: "POST",
        body: { ...data, notes: data.notes || undefined },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      onDone();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((data) => {
        setFormError(null);
        createMutation.mutate(data);
      })}
      noValidate
    >
      {formError && <ErrorState message={formError} />}
      <SelectField
        label="Evento"
        error={form.formState.errors.eventId?.message}
        {...form.register("eventId")}
      >
        <option value="">Selecione…</option>
        {events?.data.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name} ({formatDate(event.startDate)} – {formatDate(event.endDate)})
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Chalé"
        error={form.formState.errors.chaletId?.message}
        {...form.register("chaletId")}
      >
        <option value="">Selecione…</option>
        {chalets?.map((chalet) => (
          <option key={chalet.id} value={chalet.id}>
            Chalé {chalet.number} — {chalet.name}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Entrada"
          type="date"
          error={form.formState.errors.checkIn?.message}
          {...form.register("checkIn")}
        />
        <Field
          label="Saída"
          type="date"
          error={form.formState.errors.checkOut?.message}
          {...form.register("checkOut")}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field
          label="Adultos (8+)"
          type="number"
          min={0}
          error={form.formState.errors.adults?.message}
          {...form.register("adults")}
        />
        <Field
          label="Crianças (<8)"
          type="number"
          min={0}
          error={form.formState.errors.children?.message}
          {...form.register("children")}
        />
        <Field
          label="Consomem álcool"
          type="number"
          min={0}
          error={form.formState.errors.alcoholConsumers?.message}
          {...form.register("alcoholConsumers")}
        />
      </div>
      <Field label="Observações" error={form.formState.errors.notes?.message} {...form.register("notes")} />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
          Reservar
        </Button>
      </div>
    </form>
  );
}
