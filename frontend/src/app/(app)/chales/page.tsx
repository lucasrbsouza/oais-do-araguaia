"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Chalet, ChaletStatus, UserItem } from "@/lib/types";
import { CHALET_STATUS_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChaletStatusBadge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, SelectField } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { ErrorState, TableSkeleton } from "@/components/ui/states";
import { useSession } from "@/stores/session";

interface EditState {
  chalet: Chalet;
  name: string;
  ownerId: string;
  status: ChaletStatus;
}

interface CreateState {
  number: string;
  name: string;
  ownerId: string;
}

const EMPTY_CREATE: CreateState = { number: "", name: "", ownerId: "" };

export default function ChaletsPage() {
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [edit, setEdit] = useState<EditState | null>(null);
  const [create, setCreate] = useState<CreateState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Chalet | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const { data: chalets, isLoading, error } = useQuery({
    queryKey: ["chalets"],
    queryFn: () => api<Chalet[]>("/chalets"),
  });
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<UserItem[]>("/users"),
    enabled: isAdmin,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["chalets"] });

  const createMutation = useMutation({
    mutationFn: (state: CreateState) =>
      api<Chalet>("/chalets", {
        method: "POST",
        body: {
          number: Number(state.number),
          name: state.name,
          ...(state.ownerId ? { ownerId: state.ownerId } : {}),
        },
      }),
    onSuccess: () => {
      invalidate();
      setCreate(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (state: EditState) =>
      api<Chalet>(`/chalets/${state.chalet.id}`, {
        method: "PATCH",
        body: {
          name: state.name,
          status: state.status,
          // Só admin pode alterar o proprietário
          ...(isAdmin && state.ownerId ? { ownerId: state.ownerId } : {}),
        },
      }),
    onSuccess: () => {
      invalidate();
      setEdit(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/chalets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      setListError(err.message);
    },
  });

  const canEdit = (chalet: Chalet): boolean =>
    isAdmin || chalet.owner?.id === user?.id;

  if (isLoading) return <TableSkeleton rows={6} />;
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Chalés</h1>
        {isAdmin && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreate(EMPTY_CREATE);
            }}
          >
            Novo chalé
          </Button>
        )}
      </div>

      {listError && <ErrorState message={listError} />}

      <Table>
        <thead>
          <tr>
            <Th>Nº</Th>
            <Th>Nome</Th>
            <Th>Proprietário</Th>
            <Th>Status</Th>
            <Th className="w-36">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {chalets?.map((chalet) => (
            <tr key={chalet.id} className="hover:bg-surface-soft/60">
              <Td className="font-semibold text-ink">{chalet.number}</Td>
              <Td>{chalet.name}</Td>
              <Td>
                {chalet.owner?.name ?? (
                  <span className="text-muted-soft">Sem proprietário</span>
                )}
              </Td>
              <Td>
                <ChaletStatusBadge status={chalet.status} />
              </Td>
              <Td>
                <div className="flex gap-1">
                  {canEdit(chalet) && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setFormError(null);
                        setEdit({
                          chalet,
                          name: chalet.name,
                          ownerId: chalet.owner?.id ?? "",
                          status: chalet.status,
                        });
                      }}
                    >
                      Editar
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-error"
                      onClick={() => {
                        setListError(null);
                        setDeleteTarget(chalet);
                      }}
                    >
                      Excluir
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Criar (admin) */}
      <Dialog open={create !== null} onClose={() => setCreate(null)} title="Novo chalé">
        {create && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              createMutation.mutate(create);
            }}
          >
            {formError && <ErrorState message={formError} />}
            <Field
              label="Número"
              type="number"
              min={1}
              required
              value={create.number}
              onChange={(e) => setCreate({ ...create, number: e.target.value })}
            />
            <Field
              label="Nome"
              required
              minLength={2}
              value={create.name}
              onChange={(e) => setCreate({ ...create, name: e.target.value })}
            />
            <SelectField
              label="Proprietário"
              value={create.ownerId}
              onChange={(e) => setCreate({ ...create, ownerId: e.target.value })}
            >
              <option value="">Sem proprietário</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </SelectField>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setCreate(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Criar
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Editar (admin: tudo; proprietário: nome e status do próprio chalé) */}
      <Dialog
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={edit ? `Editar Chalé ${edit.chalet.number}` : ""}
      >
        {edit && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              updateMutation.mutate(edit);
            }}
          >
            {formError && <ErrorState message={formError} />}
            <Field
              label="Nome"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              required
              minLength={2}
            />
            {isAdmin && (
              <SelectField
                label="Proprietário"
                value={edit.ownerId}
                onChange={(e) => setEdit({ ...edit, ownerId: e.target.value })}
              >
                <option value="">Sem proprietário</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </SelectField>
            )}
            <SelectField
              label="Status"
              value={edit.status}
              onChange={(e) => setEdit({ ...edit, status: e.target.value as ChaletStatus })}
            >
              {Object.entries(CHALET_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setEdit(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={updateMutation.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Excluir (admin) */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Excluir chalé"
        description={
          deleteTarget
            ? `Excluir o Chalé ${deleteTarget.number} — ${deleteTarget.name}? Chalés com reservas, rateios ou pagamentos não podem ser excluídos. Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
