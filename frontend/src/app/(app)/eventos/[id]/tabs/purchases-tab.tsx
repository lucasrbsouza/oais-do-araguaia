"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip } from "lucide-react";
import { useRef, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, getReceiptUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCents, formatDate, parseBRLToCents } from "@/lib/format";
import type { Chalet, Purchase } from "@/lib/types";
import { CATEGORY_LABELS, PURCHASE_CATEGORIES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, SelectField } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { useSession } from "@/stores/session";

const schema = z.object({
  date: z.string().min(1, "Informe a data."),
  description: z.string().optional(),
  category: z.enum(PURCHASE_CATEGORIES),
  amount: z
    .string()
    .min(1, "Informe o valor.")
    .refine((v) => parseBRLToCents(v) > 0, "Valor inválido."),
  chaletId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function PurchasesTab({ eventId, eventOpen }: { eventId: string; eventOpen: boolean }) {
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  // Estados de filtro
  const [filterMyPurchases, setFilterMyPurchases] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterChaletId, setFilterChaletId] = useState<string>("");
  const [filterResponsibleId, setFilterResponsibleId] = useState<string>("");
  const [filterMinAmount, setFilterMinAmount] = useState<string>("");
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["purchases", eventId],
    queryFn: () => api<Purchase[]>(`/purchases?eventId=${eventId}`),
  });
  const { data: chalets } = useQuery({
    queryKey: ["chalets"],
    queryFn: () => api<Chalet[]>("/chalets"),
  });

  // Chalé do usuário: fixo para proprietário, pré-selecionado para admin.
  const myChalet = chalets?.find((c) => c.owner?.id === user?.id);

  // Derivar chalés únicos das compras
  const uniqueChalets = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { id: string; number: number; name: string }>();
    data.forEach((p) => {
      if (p.chalet) {
        map.set(p.chalet.id, p.chalet);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }, [data]);

  // Derivar responsáveis únicos das compras
  const uniqueResponsibles = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { id: string; name: string }>();
    data.forEach((p) => {
      map.set(p.responsible.id, p.responsible);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Filtrar as compras
  const filteredPurchases = useMemo(() => {
    if (!data) return [];
    return data.filter((p) => {
      if (filterMyPurchases && p.responsible.id !== user?.id) {
        return false;
      }
      if (filterCategory && p.category !== filterCategory) {
        return false;
      }
      if (filterChaletId) {
        if (filterChaletId === "general") {
          if (p.chalet !== null) return false;
        } else if (!p.chalet || p.chalet.id !== filterChaletId) {
          return false;
        }
      }
      if (filterResponsibleId && p.responsible.id !== filterResponsibleId) {
        return false;
      }
      if (filterMinAmount) {
        const minVal = parseFloat(filterMinAmount);
        if (!isNaN(minVal) && p.amountCents < minVal * 100) {
          return false;
        }
      }
      if (filterMaxAmount) {
        const maxVal = parseFloat(filterMaxAmount);
        if (!isNaN(maxVal) && p.amountCents > maxVal * 100) {
          return false;
        }
      }
      return true;
    });
  }, [data, filterMyPurchases, filterCategory, filterChaletId, filterResponsibleId, filterMinAmount, filterMaxAmount, user?.id]);

  const hasActiveFilters = useMemo(() => {
    return (
      filterMyPurchases ||
      filterCategory !== "" ||
      filterChaletId !== "" ||
      filterResponsibleId !== "" ||
      filterMinAmount !== "" ||
      filterMaxAmount !== ""
    );
  }, [filterMyPurchases, filterCategory, filterChaletId, filterResponsibleId, filterMinAmount, filterMaxAmount]);

  const clearFilters = () => {
    setFilterMyPurchases(false);
    setFilterCategory("");
    setFilterChaletId("");
    setFilterResponsibleId("");
    setFilterMinAmount("");
    setFilterMaxAmount("");
  };

  const canManagePurchase = (p: Purchase) => {
    if (isAdmin) return true;
    if (!user) return false;
    return p.responsible.id === user.id || (p.chalet !== null && p.chalet.id === myChalet?.id);
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["purchases", eventId] });
    void queryClient.invalidateQueries({ queryKey: ["events"] });
    void queryClient.invalidateQueries({ queryKey: ["payments", eventId] });
  };

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "GROCERY",
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: FormData) =>
      api<Purchase>("/purchases", {
        method: "POST",
        body: {
          eventId,
          date: payload.date,
          description: payload.description || undefined,
          category: payload.category,
          amountCents: parseBRLToCents(payload.amount),
          chaletId: (isAdmin ? payload.chaletId : myChalet?.id) || undefined,
        },
      }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      form.reset({
        category: "GROCERY",
        date: new Date().toISOString().slice(0, 10),
      });
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

  const total = filteredPurchases.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Total: <span className="font-semibold text-ink">{formatCents(total)}</span>
        </p>
        {eventOpen && (
          <Button
            onClick={() => {
              setFormError(null);
              form.reset({
                category: "GROCERY",
                chaletId: myChalet?.id ?? "",
                date: new Date().toISOString().slice(0, 10),
              });
              setOpen(true);
            }}
          >
            Nova compra
          </Button>
        )}
      </div>

      {/* Barra de Filtros */}
      {data && data.length > 0 && (
        <div className="bg-surface-soft p-4 rounded-md border border-hairline flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm font-semibold text-ink">Filtros</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="filter-my-purchases"
                  checked={filterMyPurchases}
                  onChange={(e) => setFilterMyPurchases(e.target.checked)}
                  className="rounded-xs border-hairline text-primary focus:ring-primary size-4 accent-primary cursor-pointer"
                />
                <label htmlFor="filter-my-purchases" className="text-sm text-ink font-medium select-none cursor-pointer">
                  Minhas compras
                </label>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary font-medium hover:underline cursor-pointer"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Categoria */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-category" className="text-xs font-semibold text-muted">
                Categoria
              </label>
              <select
                id="filter-category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="h-11 rounded-sm border border-hairline bg-canvas px-2 text-base text-ink focus:border-ink focus:outline-none sm:h-10 sm:text-sm"
              >
                <option value="">Todas</option>
                {PURCHASE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            {/* Chalé */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-chalet" className="text-xs font-semibold text-muted">
                Chalé
              </label>
              <select
                id="filter-chalet"
                value={filterChaletId}
                onChange={(e) => setFilterChaletId(e.target.value)}
                className="h-11 rounded-sm border border-hairline bg-canvas px-2 text-base text-ink focus:border-ink focus:outline-none sm:h-10 sm:text-sm"
              >
                <option value="">Todos</option>
                <option value="general">Geral (Sem chalé)</option>
                {uniqueChalets.map((c) => (
                  <option key={c.id} value={c.id}>
                    Chalé {c.number} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Responsável */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-responsible" className="text-xs font-semibold text-muted">
                Responsável
              </label>
              <select
                id="filter-responsible"
                value={filterResponsibleId}
                onChange={(e) => setFilterResponsibleId(e.target.value)}
                className="h-11 rounded-sm border border-hairline bg-canvas px-2 text-base text-ink focus:border-ink focus:outline-none sm:h-10 sm:text-sm"
              >
                <option value="">Todos</option>
                {uniqueResponsibles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Valor Mínimo */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-min-amount" className="text-xs font-semibold text-muted">
                Valor mínimo (R$)
              </label>
              <input
                id="filter-min-amount"
                type="number"
                min="0"
                step="any"
                placeholder="Ex: 10.00"
                value={filterMinAmount}
                onChange={(e) => setFilterMinAmount(e.target.value)}
                className="h-11 rounded-sm border border-hairline bg-canvas px-2 text-base text-ink placeholder:text-muted-soft focus:border-ink focus:outline-none sm:h-10 sm:text-sm"
              />
            </div>

            {/* Valor Máximo */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-max-amount" className="text-xs font-semibold text-muted">
                Valor máximo (R$)
              </label>
              <input
                id="filter-max-amount"
                type="number"
                min="0"
                step="any"
                placeholder="Ex: 200.00"
                value={filterMaxAmount}
                onChange={(e) => setFilterMaxAmount(e.target.value)}
                className="h-11 rounded-sm border border-hairline bg-canvas px-2 text-base text-ink placeholder:text-muted-soft focus:border-ink focus:outline-none sm:h-10 sm:text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {listError && <ErrorState message={listError} />}

      {data?.length === 0 ? (
        <EmptyState title="Nenhuma compra lançada" />
      ) : filteredPurchases.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center border border-hairline border-dashed rounded-md bg-canvas gap-3">
          <p className="text-sm text-muted">Nenhuma compra atende aos filtros selecionados.</p>
          <Button variant="secondary" size="xs" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Descrição</Th>
              <Th>Categoria</Th>
              <Th>Responsável</Th>
              <Th>Adiantamento</Th>
              <Th className="text-right">Valor</Th>
              <Th className="w-40">Comprovante</Th>
              {eventOpen && <Th className="w-20">Ações</Th>}
            </tr>
          </thead>
          <tbody>
            {filteredPurchases.map((p) => {
              const isMyPurchase = p.responsible.id === user?.id;
              return (
                <tr
                  key={p.id}
                  className={cn(isMyPurchase && "bg-primary/[0.04] border-l-2 border-l-primary")}
                >
                  <Td label="Data">{formatDate(p.date)}</Td>
                  <Td label="Descrição" className="font-medium text-ink">
                    {p.description ?? <span className="text-muted-soft">—</span>}
                  </Td>
                  <Td label="Categoria">{CATEGORY_LABELS[p.category]}</Td>
                  <Td label="Responsável">
                    <span className="flex items-center gap-1.5">
                      {p.responsible.name}
                      {isMyPurchase && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Você
                        </span>
                      )}
                    </span>
                  </Td>
                <Td label="Adiantamento">
                  {p.chalet ? (
                    `Chalé ${p.chalet.number} — ${p.chalet.name}`
                  ) : (
                    <span className="text-muted-soft">—</span>
                  )}
                </Td>
                <Td label="Valor" className="text-right font-medium">{formatCents(p.amountCents)}</Td>
                <Td label="Comprovante">
                  <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
                    {p.hasReceipt && (
                      <Button variant="ghost" size="xs" onClick={() => void openReceipt(p.id)}>
                        Ver
                      </Button>
                    )}
                    {eventOpen && canManagePurchase(p) && (
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
                    {canManagePurchase(p) && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-error"
                        onClick={() => setDeleteTarget(p)}
                      >
                        Excluir
                      </Button>
                    )}
                  </Td>
                )}
                </tr>
              );
            })}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            label="Descrição (opcional)"
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
          {isAdmin ? (
            <>
              <SelectField
                label="Adiantamento do chalé (opcional)"
                error={form.formState.errors.chaletId?.message}
                {...form.register("chaletId")}
              >
                <option value="">Nenhum — despesa geral do evento</option>
                {chalets?.map((chalet) => (
                  <option key={chalet.id} value={chalet.id}>
                    Chalé {chalet.number} — {chalet.name}
                    {chalet.id === myChalet?.id ? " (seu chalé)" : ""}
                  </option>
                ))}
              </SelectField>
              <p className="text-xs text-muted">
                {myChalet
                  ? "Seu chalé vem pré-selecionado; troque para lançar em outro chalé ou como despesa geral."
                  : "Compras vinculadas a um chalé contam como adiantamento e abatem o saldo dele em Contas a Pagar."}
              </p>
            </>
          ) : myChalet ? (
            <p className="text-sm text-muted">
              Compra vinculada ao seu chalé:{" "}
              <span className="font-semibold text-ink">
                Chalé {myChalet.number} — {myChalet.name}
              </span>
            </p>
          ) : (
            <ErrorState message="Você não possui chalé vinculado para lançar compras." />
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              disabled={!isAdmin && !myChalet}
            >
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
            ? `Excluir "${deleteTarget.description ?? CATEGORY_LABELS[deleteTarget.category]}" (${formatCents(deleteTarget.amountCents)})? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
