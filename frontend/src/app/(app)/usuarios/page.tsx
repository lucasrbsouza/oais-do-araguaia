"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api";
import type { UserItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, SelectField } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { ErrorState, TableSkeleton } from "@/components/ui/states";

const schema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "Mínimo de 8 caracteres."),
  role: z.enum(["ADMIN", "OWNER"]),
});

type FormData = z.infer<typeof schema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<UserItem[]>("/users"),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "OWNER" },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api<UserItem>("/users", { method: "POST", body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      form.reset({ role: "OWNER" });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: (user: UserItem) =>
      api<UserItem>(`/users/${user.id}`, { method: "PATCH", body: { active: !user.active } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  if (isLoading) return <TableSkeleton rows={5} />;
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Usuários</h1>
        <Button onClick={() => setOpen(true)}>Novo usuário</Button>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Nome</Th>
            <Th>E-mail</Th>
            <Th>Perfil</Th>
            <Th>Situação</Th>
            <Th className="w-28">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} className="hover:bg-surface-soft/60">
              <Td className="font-medium text-ink">{u.name}</Td>
              <Td>{u.email}</Td>
              <Td>{u.role === "ADMIN" ? "Administrador" : "Proprietário"}</Td>
              <Td>
                <Badge tone={u.active ? "success" : "neutral"}>
                  {u.active ? "Ativo" : "Inativo"}
                </Badge>
              </Td>
              <Td>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => toggleActive.mutate(u)}
                  loading={toggleActive.isPending && toggleActive.variables?.id === u.id}
                >
                  {u.active ? "Desativar" : "Ativar"}
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

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
          <Field
            label="Senha"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.password?.message}
            {...form.register("password")}
          />
          <SelectField label="Perfil" {...form.register("role")}>
            <option value="OWNER">Proprietário</option>
            <option value="ADMIN">Administrador</option>
          </SelectField>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Criar
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
