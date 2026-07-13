"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Chalet, UserItem } from "@/lib/types";
import { useSession } from "@/stores/session";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, PasswordField, PhoneField, SelectField } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { ErrorState, TableSkeleton } from "@/components/ui/states";

const schema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "Mínimo de 8 caracteres."),
  role: z.enum(["ADMIN", "OWNER"]),
  phone: z.string().max(20, "Máximo 20 caracteres.").optional().or(z.literal("")),
  /** Vínculo opcional: chalé ainda sem proprietário, atribuído ao novo usuário. */
  chaletId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function UsersPage() {
  const { user: sessionUser } = useSession();
  const isAdmin = sessionUser?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<UserItem[]>("/users"),
  });

  const { data: chalets } = useQuery({
    queryKey: ["chalets"],
    queryFn: () => api<Chalet[]>("/chalets"),
    enabled: isAdmin,
  });

  // Só faz sentido oferecer chalé que ainda não tem dono.
  const availableChalets = chalets?.filter((c) => c.owner === null) ?? [];

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "OWNER", chaletId: "" },
  });

  const createMutation = useMutation({
    mutationFn: async ({ chaletId, ...data }: FormData) => {
      const created = await api<UserItem>("/users", { method: "POST", body: data });
      if (chaletId) {
        // Dois passos porque o vínculo é do chalé: se falhar, o usuário já existe
        // e o admin refaz o vínculo pela tela de chalés — daí a mensagem abaixo.
        try {
          await api<Chalet>(`/chalets/${chaletId}`, {
            method: "PATCH",
            body: { ownerId: created.id },
          });
        } catch (err) {
          throw new Error(
            `Usuário criado, mas o chalé não pôde ser vinculado: ${(err as Error).message} ` +
              "Vincule pela tela de Chalés.",
          );
        }
      }
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["chalets"] });
      setOpen(false);
      form.reset({ role: "OWNER", phone: "", chaletId: "" });
    },
    onError: (err: Error) => {
      // O usuário pode ter sido criado mesmo com erro no vínculo do chalé.
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["chalets"] });
      setFormError(err.message);
    },
  });

  const toggleActive = useMutation({
    mutationFn: (user: UserItem) =>
      api<UserItem>(`/users/${user.id}`, { method: "PATCH", body: { active: !user.active } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      setListError(err.message);
    },
  });

  if (isLoading) return <TableSkeleton rows={5} />;
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Usuários</h1>
        {isAdmin && <Button onClick={() => setOpen(true)}>Novo usuário</Button>}
      </div>

      {listError && <ErrorState message={listError} />}

      <Table>
        <thead>
          <tr>
            <Th>Nome</Th>
            <Th>E-mail</Th>
            <Th>Telefone</Th>
            <Th>Perfil</Th>
            <Th>Situação</Th>
            {isAdmin && <Th className="w-44">Ações</Th>}
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => {
            const isMe = u.id === sessionUser?.id;
            return (
            <tr
              key={u.id}
              className={cn(
                "hover:bg-surface-soft/60",
                isMe && "bg-primary/[0.04] border-l-2 border-l-primary",
              )}
            >
              <Td label="Nome">
                <Link
                  href={isMe ? "/perfil" : `/usuarios/${u.id}`}
                  className="flex items-center gap-2.5 font-medium text-ink hover:text-primary transition-colors"
                >
                  <UserAvatar userId={u.id} name={u.name} hasAvatar={u.hasAvatar} className="size-7" />
                  {u.name}
                  {isMe && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Você
                    </span>
                  )}
                </Link>
              </Td>
              <Td label="E-mail">{u.email}</Td>
              <Td label="Telefone" className="text-muted">{u.phone || "—"}</Td>
              <Td label="Perfil">{u.role === "ADMIN" ? "Administrador" : "Proprietário"}</Td>
              <Td label="Situação">
                <Badge tone={u.active ? "success" : "neutral"}>
                  {u.active ? "Ativo" : "Inativo"}
                </Badge>
              </Td>
              {isAdmin && (
                <Td>
                  <div className="flex flex-wrap items-center gap-1 xl:flex-nowrap">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => toggleActive.mutate(u)}
                      loading={toggleActive.isPending && toggleActive.variables?.id === u.id}
                    >
                      {u.active ? "Desativar" : "Ativar"}
                    </Button>
                    {u.id !== sessionUser?.id && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-error"
                        onClick={() => {
                          setListError(null);
                          setDeleteTarget(u);
                        }}
                      >
                        Excluir
                      </Button>
                    )}
                  </div>
                </Td>
              )}
            </tr>
          );
          })}
        </tbody>
      </Table>

      {isAdmin && (
        <Dialog open={open} onClose={() => setOpen(false)} title="Novo usuário">
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((data) => {
              setFormError(null);
              createMutation.mutate(data);
            })}
            noValidate
          >
            {formError && <ErrorState message={formError} />}
            <Field label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
            <Field
              label="E-mail"
              type="email"
              error={form.formState.errors.email?.message}
              {...form.register("email")}
            />
            <PasswordField
              label="Senha"
              autoComplete="new-password"
              error={form.formState.errors.password?.message}
              {...form.register("password")}
            />
            <SelectField label="Perfil" {...form.register("role")}>
              <option value="OWNER">Proprietário</option>
              <option value="ADMIN">Administrador</option>
            </SelectField>
            <PhoneField
              label="Telefone (opcional)"
              error={form.formState.errors.phone?.message}
              {...form.register("phone")}
            />
            {availableChalets.length > 0 ? (
              <SelectField label="Chalé (opcional)" {...form.register("chaletId")}>
                <option value="">Nenhum por enquanto</option>
                {availableChalets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number} — {c.name}
                  </option>
                ))}
              </SelectField>
            ) : (
              <p className="text-xs text-muted">
                Nenhum chalé sem proprietário no momento. O vínculo pode ser feito depois,
                na tela de Chalés.
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Criar
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {isAdmin && (
        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          title="Excluir usuário"
          description={
            deleteTarget
              ? `Excluir o usuário ${deleteTarget.name}? Usuários com chalés, reservas, compras ou pagamentos vinculados não podem ser excluídos. Esta ação não pode ser desfeita.`
              : ""
          }
          confirmLabel="Excluir"
          destructive
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

