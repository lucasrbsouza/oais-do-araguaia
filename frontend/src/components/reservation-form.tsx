"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api";
import { formatDate, nightsBetween } from "@/lib/format";
import type { Chalet, EventItem, Paginated, Reservation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { useSession } from "@/stores/session";

/** Uma entrada = um check-in/check-out. O chalé tem 3 suítes e aceita várias. */
const staySchema = z
  .object({
    checkIn: z.string().min(1, "Informe a entrada."),
    checkOut: z.string().min(1, "Informe a saída."),
    adults: z.coerce.number().int().min(0),
    children: z.coerce.number().int().min(0),
    alcoholConsumers: z.coerce.number().int().min(0),
    notes: z.string().max(500).optional(),
  })
  .refine((s) => s.checkOut >= s.checkIn, {
    message: "A saída não pode ser antes da entrada.",
    path: ["checkOut"],
  });

const schema = z.object({
  eventId: z.string().min(1, "Selecione o evento."),
  chaletId: z.string().min(1, "Selecione o chalé."),
  stays: z.array(staySchema).min(1),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
type StayInput = z.input<typeof staySchema>;

const today = () => new Date().toISOString().slice(0, 10);

const emptyStay = (): StayInput => ({
  checkIn: today(),
  checkOut: today(),
  adults: 1,
  children: 0,
  alcoholConsumers: 0,
  notes: "",
});

interface ReservationFormProps {
  defaultEventId?: string;
  /** Quando presente, o formulário edita a entrada em vez de criar. */
  reservation?: Reservation;
  onDone: () => void;
}

export function ReservationForm({ defaultEventId, reservation, onDone }: ReservationFormProps) {
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = reservation !== undefined;

  const { data: events } = useQuery({
    queryKey: ["events", "open"],
    queryFn: () => api<Paginated<EventItem>>("/events?status=OPEN&page=1&perPage=50"),
    enabled: !isEdit,
  });
  const { data: chalets } = useQuery({
    queryKey: ["chalets"],
    queryFn: () => api<Chalet[]>("/chalets"),
    enabled: !isEdit,
  });

  // Proprietário: reserva sempre do próprio chalé, sem seleção.
  const myChalet = chalets?.find((c) => c.owner?.id === user?.id);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: reservation
      ? {
          eventId: reservation.eventId,
          chaletId: reservation.chalet.id,
          stays: [
            {
              checkIn: reservation.checkIn.slice(0, 10),
              checkOut: reservation.checkOut.slice(0, 10),
              adults: reservation.adults,
              children: reservation.children,
              alcoholConsumers: reservation.alcoholConsumers,
              notes: reservation.notes ?? "",
            },
          ],
        }
      : {
          eventId: defaultEventId ?? "",
          chaletId: "",
          stays: [emptyStay()],
        },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "stays" });
  const stays = useWatch({ control: form.control, name: "stays" });

  useEffect(() => {
    if (!isAdmin && !isEdit && myChalet) {
      form.setValue("chaletId", myChalet.id, { shouldValidate: false });
    }
  }, [isAdmin, isEdit, myChalet, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormOutput) => {
      if (isEdit) {
        const stay = data.stays[0];
        await api<Reservation>(`/reservations/${reservation.id}`, {
          method: "PATCH",
          body: {
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            adults: stay.adults,
            children: stay.children,
            alcoholConsumers: stay.alcoholConsumers,
            notes: stay.notes || undefined,
          },
        });
        return;
      }
      // Uma entrada por vez: o servidor precisa enxergar as anteriores para
      // aplicar o limite de 3 suítes simultâneas.
      for (const [index, stay] of data.stays.entries()) {
        try {
          await api<Reservation>("/reservations", {
            method: "POST",
            body: {
              eventId: data.eventId,
              chaletId: data.chaletId,
              checkIn: stay.checkIn,
              checkOut: stay.checkOut,
              adults: stay.adults,
              children: stay.children,
              alcoholConsumers: stay.alcoholConsumers,
              notes: stay.notes || undefined,
            },
          });
        } catch (err) {
          const saved = index > 0 ? ` As ${index} entrada(s) anteriores foram salvas.` : "";
          throw new Error(`Entrada ${index + 1}: ${(err as Error).message}${saved}`);
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      onDone();
    },
    onError: (err: Error) => {
      // Parte das entradas pode ter entrado antes do erro: recarrega a lista.
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setFormError(err.message);
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((data) => {
        setFormError(null);
        saveMutation.mutate(data);
      })}
      noValidate
    >
      {formError && <ErrorState message={formError} />}
      {isEdit ? (
        <p className="text-sm text-muted">
          Chalé {reservation.chalet.number} — {reservation.chalet.name} · responsável{" "}
          {reservation.responsible.name}
        </p>
      ) : (
        <>
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
          {isAdmin ? (
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
          ) : myChalet ? (
            <p className="text-sm text-muted">
              Reserva do seu chalé:{" "}
              <span className="font-semibold text-ink">
                Chalé {myChalet.number} — {myChalet.name}
              </span>
            </p>
          ) : (
            <ErrorState message="Você não possui chalé vinculado para reservar." />
          )}
        </>
      )}

      {fields.map((field, index) => {
        const stay = stays?.[index];
        const nights =
          stay?.checkIn && stay?.checkOut ? nightsBetween(stay.checkIn, stay.checkOut) : null;
        const errors = form.formState.errors.stays?.[index];
        return (
          <fieldset
            key={field.id}
            className="space-y-4 rounded-md border border-hairline bg-surface-soft/50 p-2 sm:p-3"
          >
            {!isEdit && (
              <div className="flex items-center justify-between gap-2">
                <legend className="text-sm font-semibold text-ink">
                  Entrada {index + 1}
                  {nights !== null && (
                    <span className="ml-2 font-normal text-muted">
                      {nights} {nights === 1 ? "diária" : "diárias"}
                    </span>
                  )}
                </legend>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-error"
                    onClick={() => remove(index)}
                  >
                    Remover
                  </Button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Field
                label="Entrada"
                type="date"
                error={errors?.checkIn?.message}
                {...form.register(`stays.${index}.checkIn`)}
              />
              <Field
                label="Saída"
                type="date"
                error={errors?.checkOut?.message}
                {...form.register(`stays.${index}.checkOut`)}
              />
            </div>
            {/* items-end: no celular os rótulos longos quebram em duas linhas e
                desalinhariam os campos; alinhar pela base mantém a linha reta. */}
            <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
              <Field
                label="Adultos (8+)"
                type="number"
                min={0}
                error={errors?.adults?.message}
                {...form.register(`stays.${index}.adults`)}
              />
              <Field
                label="Crianças (<8)"
                type="number"
                min={0}
                error={errors?.children?.message}
                {...form.register(`stays.${index}.children`)}
              />
              <Field
                label="Consomem álcool"
                type="number"
                min={0}
                error={errors?.alcoholConsumers?.message}
                {...form.register(`stays.${index}.alcoholConsumers`)}
              />
            </div>
            <Field
              label="Observações"
              error={errors?.notes?.message}
              {...form.register(`stays.${index}.notes`)}
            />
          </fieldset>
        );
      })}

      {!isEdit && (
        <div className="space-y-1">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => append(emptyStay())}
          >
            + Incluir nova entrada
          </Button>
          <p className="text-xs text-muted">
            O chalé tem 3 suítes: até 3 entradas podem se sobrepor. Cada entrada tem seu próprio
            período e hóspedes, e o rateio conta as diárias de cada uma.
          </p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={saveMutation.isPending}
          disabled={!isEdit && !isAdmin && !myChalet}
        >
          {isEdit
            ? "Salvar alterações"
            : fields.length > 1
              ? `Reservar ${fields.length} entradas`
              : "Reservar"}
        </Button>
      </div>
    </form>
  );
}
