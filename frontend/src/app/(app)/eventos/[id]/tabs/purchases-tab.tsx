"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, getReceiptUrl } from "@/lib/api";
import { formatCents, formatDate, parseBRLToCents } from "@/lib/format";
import type { Purchase } from "@/lib/types";
import { CATEGORY_LABELS, PURCHASE_CATEGORIES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, SelectField } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";

const schema = z.object({
  date: z.string().min(1, "Informe a data."),
  description: z.string().min(2, "Descreva a compra."),
  category: z.enum(PURCHASE_CATEGORIES),
  amount: z
    .string()
    .min(1, "Informe o valor.")
    .refine((v) => parseBRLToCents(v) > 0, "Valor inválido."),
});

type FormData = z.infer<typeof schema>;

export function PurchasesTab({ eventId, eventOpen }: { eventId: string; eventOpen: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["purchases", eventId],
    queryFn: () => api<Purchase[]>(`/purchases?eventId=${eventId}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["purchases", eventId] });
    void queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: "GROCERY" },
  });

  const createMutation = useMutation({
    mutationFn: (payload: FormData) =>
      api<Purchase>("/purchases", {
        method: "POST",
        body: {
          eventId,
          date: payload.date,
          description: payload.description,
          category: payload.category,
          amountCents: parseBRLToCents(payload.amount),
        },
      }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      form.reset({ category: "GROCERY" });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/purchases/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      setListError(err.message);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return api<Purchase>(`/purchases/${id}/receipt`, { method: "POST", formData });
    },
    onSuccess: invalidate,
    onError: (err: Error) => setListError(err.message),
  });

  const openReceipt = async (id: string) => {
    const url = await getReceiptUrl(id);
    if (!url) {
      setListError("Não foi possível abrir o comprovante.");
      return;
    }
    window.open(url, "_blank");
  };

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={(error as Error).message} />;

  const total = data?.reduce((sum, p) => sum + p.amountCents, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Total: <span className="font-semibold text-ink">{formatCents(total)}</span>
        </p>
        {eventOpen && <Button onClick={() => setOpen(true)}>Nova compra</Button>}
      </div>

      {listError && <ErrorState message={listError} />}

      {data?.length === 0 ? (
        <EmptyState title="Nenhuma compra lançada" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Descrição</Th>
              <Th>Categoria</Th>
              <Th>Responsável</Th>
              <Th className="text-right">Valor</Th>
              <Th className="w-40">Comprovante</Th>
              {eventOpen && <Th className="w-20">Ações</Th>}
            </tr>
          </thead>
          <tbody>
            {data?.map((p) => (
              <tr key={p.id}>
                <Td>{formatDate(p.date)}</Td>
                <Td className="font-medium text-ink">{p.description}</Td>
                <Td>{CATEGORY_LABELS[p.category]}</Td>
                <Td>{p.responsible.name}</Td>
                <Td className="text-right font-medium">{formatCents(p.amountCents)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    {p.hasReceipt && (
                      <Button variant="ghost" size="xs" onClick={() => void openReceipt(p.id)}>
                        Ver
                      </Button>
                    )}
                    {eventOpen && (
                      <Button
                        variant="ghost"
                        size="xs"
                        aria-label="Anexar comprovante"
                        loading={uploadMutation.isPending && uploadTarget === p.id}
                        onClick={() => {
                          setUploadTarget(p.id);
                          fileInputRef.current?.click();
                        }}
                      >
                        <Paperclip className="size-3.5" /> Anexar
                      </Button>
                    )}
                  </div>
                </Td>
                {eventOpen && (
                  <Td>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-error"
                      onClick={() => setDeleteTarget(p)}
                    >
                      Excluir
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTarget) {
            setListError(null);
            uploadMutation.mutate({ id: uploadTarget, file });
          }
          e.target.value = "";
        }}
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="Nova compra">
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((payload) => {
            setFormError(null);
            createMutation.mutate(payload);
          })}
          noValidate
        >
          {formError && <ErrorState message={formError} />}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Data"
              type="date"
              error={form.formState.errors.date?.message}
              {...form.register("date")}
            />
            <SelectField label="Categoria" {...form.register("category")}>
              {PURCHASE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </SelectField>
          </div>
          <Field
            label="Descrição"
            error={form.formState.errors.description?.message}
            {...form.register("description")}
          />
          <Field
            label="Valor (R$)"
            placeholder="0,00"
            inputMode="decimal"
            error={form.formState.errors.amount?.message}
            {...form.register("amount")}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Lançar
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Excluir compra"
        description={
          deleteTarget
            ? `Excluir "${deleteTarget.description}" (${formatCents(deleteTarget.amountCents)})? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
