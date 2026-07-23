"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Chalet, ChaletStatus, UserItem } from "@/lib/types";
import { CHALET_STATUS_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChaletStatusBadge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, PasswordField, PhoneField, SelectField } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { ErrorState, TableSkeleton } from "@/components/ui/states";
import { useSession } from "@/stores/session";
import { CredentialsDialog, type NewCredentials } from "@/components/credentials-dialog";

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

interface ChaletMemberDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

interface AddMemberFormData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

const EMPTY_CREATE: CreateState = { number: "", name: "", ownerId: "" };
const EMPTY_MEMBER: AddMemberFormData = { name: "", email: "", password: "", phone: "" };

export default function ChaletsPage() {
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [edit, setEdit] = useState<EditState | null>(null);
  const [create, setCreate] = useState<CreateState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Chalet | null>(null);
  const [membersTarget, setMembersTarget] = useState<Chalet | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberMode, setAddMemberMode] = useState<"select" | "create">("select");
  const [selectedExistingUserId, setSelectedExistingUserId] = useState<string>("");
  const [addMemberForm, setAddMemberForm] = useState<AddMemberFormData>(EMPTY_MEMBER);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<NewCredentials | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [filterMyChalets, setFilterMyChalets] = useState(false);

  const { data: chalets, isLoading, error } = useQuery({
    queryKey: ["chalets"],
    queryFn: () => api<Chalet[]>("/chalets"),
  });

  const { data: members, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["chalet-members", membersTarget?.id],
    queryFn: () => api<ChaletMemberDetail[]>(`/chalets/${membersTarget!.id}/members`),
    enabled: !!membersTarget,
  });

  const filteredChalets = useMemo(() => {
    if (!chalets) return [];
    if (!filterMyChalets) return chalets;
    return chalets.filter(
      (c) => c.owner?.id === user?.id || c.members?.some((m) => m.id === user?.id),
    );
  }, [chalets, filterMyChalets, user?.id]);

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<UserItem[]>("/users"),
    enabled: isAdmin || !!membersTarget,
  });

  const availableUsersToLink = useMemo(() => {
    if (!users || !membersTarget) return [];
    const memberIds = new Set((members ?? []).map((m) => m.id));
    return users.filter(
      (u) => u.id !== membersTarget.owner?.id && !memberIds.has(u.id),
    );
  }, [users, membersTarget, members]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["chalets"] });
    if (membersTarget) {
      void queryClient.invalidateQueries({ queryKey: ["chalet-members", membersTarget.id] });
    }
  };

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

  type AddMemberPayload = {
    userId?: string;
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
  };

  const addMemberMutation = useMutation({
    mutationFn: (data: AddMemberPayload) =>
      api<{ id: string; name: string; email: string }>(`/chalets/${membersTarget!.id}/members`, {
        method: "POST",
        body: data,
      }),
    onSuccess: (_res, variables) => {
      invalidate();
      setShowAddMember(false);
      if (variables.name && variables.password && variables.email) {
        setCredentials({
          name: variables.name,
          email: variables.email,
          password: variables.password,
        });
      }
      setAddMemberForm(EMPTY_MEMBER);
      setSelectedExistingUserId("");
      setMemberError(null);
    },
    onError: (err: Error) => setMemberError(err.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api<void>(`/chalets/${membersTarget!.id}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => setMemberError(err.message),
  });

  const canEdit = (chalet: Chalet): boolean =>
    Boolean(isAdmin || chalet.owner?.id === user?.id || chalet.members?.some((m) => m.id === user?.id));

  const canManageMembers = (chalet: Chalet): boolean =>
    isAdmin || chalet.owner?.id === user?.id;

  if (isLoading) return <TableSkeleton rows={6} />;
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      {chalets && chalets.length > 0 && (
        <div className="flex items-center gap-2 bg-surface-soft p-3 rounded-md border border-hairline max-w-xs">
          <input
            type="checkbox"
            id="filter-my-chalets"
            checked={filterMyChalets}
            onChange={(e) => setFilterMyChalets(e.target.checked)}
            className="rounded-xs border-hairline text-primary focus:ring-primary size-4 accent-primary cursor-pointer"
          />
          <label htmlFor="filter-my-chalets" className="text-sm text-ink font-medium select-none cursor-pointer">
            Meus chalés
          </label>
        </div>
      )}

      {filteredChalets.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center border border-hairline border-dashed rounded-md bg-canvas gap-3">
          <p className="text-sm text-muted">Nenhum chalé atende a este filtro.</p>
          {filterMyChalets && (
            <Button variant="secondary" size="xs" onClick={() => setFilterMyChalets(false)}>
              Ver todos os chalés
            </Button>
          )}
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nº</Th>
              <Th>Nome</Th>
              <Th>Proprietário</Th>
              <Th>Familiares</Th>
              <Th>Status</Th>
              <Th className="w-48">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filteredChalets.map((chalet) => {
              const isMine = chalet.owner?.id === user?.id || chalet.members?.some((m) => m.id === user?.id);
              const memberCount = chalet.members?.length ?? 0;

              return (
                <tr
                  key={chalet.id}
                  className={cn(
                    "hover:bg-surface-soft/60",
                    isMine && "bg-primary/[0.04] border-l-2 border-l-primary"
                  )}
                >
                  <Td label="Nº" className="font-semibold text-ink">
                    {chalet.number}
                  </Td>
                  <Td label="Nome">{chalet.name}</Td>
                  <Td label="Proprietário">
                    {chalet.owner ? (
                      <span className="flex items-center gap-1.5">
                        {chalet.owner.name}
                        {chalet.owner.id === user?.id && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Você (Dono)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-soft">Sem proprietário</span>
                    )}
                  </Td>
                  <Td label="Familiares">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted font-medium">
                      <Users className="size-3.5 text-primary" aria-hidden />
                      {memberCount}/4 familiares
                    </span>
                  </Td>
                  <Td label="Status">
                    <ChaletStatusBadge status={chalet.status} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1 xl:flex-nowrap">
                      {canManageMembers(chalet) && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setMemberError(null);
                            setShowAddMember(false);
                            setMembersTarget(chalet);
                          }}
                        >
                          Membros ({memberCount}/4)
                        </Button>
                      )}
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
              );
            })}
          </tbody>
        </Table>
      )}

      {/* Gerenciar Membros (Admin ou Dono do Chalé) */}
      <Dialog
        open={membersTarget !== null}
        onClose={() => {
          setMembersTarget(null);
          setShowAddMember(false);
        }}
        title={membersTarget ? `Gerenciar Membros — Chalé ${membersTarget.number}` : ""}
      >
        {membersTarget && (
          <div className="space-y-5">
            <p className="text-xs text-muted">
              Até 5 acessos por chalé (1 proprietário + até 4 familiares vinculados).
              Familiares têm acesso completo ao sistema deste chalé.
            </p>

            {memberError && <ErrorState message={memberError} />}

            {isLoadingMembers ? (
              <p className="text-sm text-muted py-4">Carregando familiares...</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">
                    Familiares cadastrados ({(members?.length ?? 0)}/4)
                  </h3>
                  {(members?.length ?? 0) < 4 && !showAddMember && (
                    <Button
                      size="xs"
                      onClick={() => {
                        setMemberError(null);
                        setShowAddMember(true);
                      }}
                    >
                      <UserPlus className="size-3.5 mr-1" aria-hidden />
                      Novo familiar
                    </Button>
                  )}
                </div>

                {members && members.length > 0 ? (
                  <ul className="divide-y divide-hairline rounded-md border border-hairline bg-canvas">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between p-3 text-sm">
                        <div>
                          <p className="font-medium text-ink">{m.name}</p>
                          <p className="text-xs text-muted">{m.email} {m.phone ? `• ${m.phone}` : ""}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-error hover:bg-error/10"
                          loading={removeMemberMutation.isPending && removeMemberMutation.variables === m.id}
                          onClick={() => removeMemberMutation.mutate(m.id)}
                        >
                          <Trash2 className="size-3.5 mr-1" aria-hidden />
                          Remover
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted py-3 italic">Nenhum familiar cadastrado até o momento.</p>
                )}

                {showAddMember && (
                  <div className="space-y-3 rounded-md border border-primary/20 bg-primary/[0.02] p-4 border-dashed">
                    <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2">
                      <h4 className="text-sm font-semibold text-ink">Adicionar familiar</h4>
                      <div className="flex gap-1 text-xs">
                        <button
                          type="button"
                          className={cn(
                            "px-2.5 py-1 rounded font-medium transition-colors",
                            addMemberMode === "select"
                              ? "bg-primary text-white"
                              : "text-muted hover:text-ink bg-surface-soft",
                          )}
                          onClick={() => setAddMemberMode("select")}
                        >
                          Selecionar existente
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "px-2.5 py-1 rounded font-medium transition-colors",
                            addMemberMode === "create"
                              ? "bg-primary text-white"
                              : "text-muted hover:text-ink bg-surface-soft",
                          )}
                          onClick={() => setAddMemberMode("create")}
                        >
                          Criar novo
                        </button>
                      </div>
                    </div>

                    {addMemberMode === "select" ? (
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!selectedExistingUserId) return;
                          setMemberError(null);
                          addMemberMutation.mutate({ userId: selectedExistingUserId });
                        }}
                      >
                        <SelectField
                          label="Selecionar usuário cadastrado"
                          value={selectedExistingUserId}
                          onChange={(e) => setSelectedExistingUserId(e.target.value)}
                        >
                          <option value="">Selecione um usuário...</option>
                          {availableUsersToLink.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                        </SelectField>
                        {availableUsersToLink.length === 0 && (
                          <p className="text-xs text-muted">
                            Não há outros usuários disponíveis para vincular neste momento. Use a opção &quot;Criar novo&quot;.
                          </p>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => setShowAddMember(false)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="submit"
                            size="xs"
                            disabled={!selectedExistingUserId}
                            loading={addMemberMutation.isPending}
                          >
                            Vincular ao Chalé
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          setMemberError(null);
                          addMemberMutation.mutate(addMemberForm);
                        }}
                      >
                        <Field
                          label="Nome"
                          required
                          minLength={2}
                          value={addMemberForm.name}
                          onChange={(e) => setAddMemberForm({ ...addMemberForm, name: e.target.value })}
                        />
                        <Field
                          label="E-mail"
                          type="email"
                          required
                          value={addMemberForm.email}
                          onChange={(e) => setAddMemberForm({ ...addMemberForm, email: e.target.value })}
                        />
                        <PasswordField
                          label="Senha provisória"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          value={addMemberForm.password}
                          onChange={(e) => setAddMemberForm({ ...addMemberForm, password: e.target.value })}
                        />
                        <PhoneField
                          label="Telefone (opcional)"
                          value={addMemberForm.phone ?? ""}
                          onChange={(e) => setAddMemberForm({ ...addMemberForm, phone: e.target.value })}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => setShowAddMember(false)}
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" size="xs" loading={addMemberMutation.isPending}>
                            Salvar e gerar acesso
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setMembersTarget(null);
                  setShowAddMember(false);
                }}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Credenciais para enviar ao familiar criado */}
      {credentials && (
        <CredentialsDialog
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}

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
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
