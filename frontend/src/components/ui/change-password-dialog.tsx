"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api";
import type { UserItem } from "@/lib/types";
import { useSession } from "@/stores/session";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { PasswordField } from "./input";
import { ErrorState } from "./states";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(8, "Mínimo de 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  /** When true, shows a friendlier copy for first-login flow. */
  firstLogin?: boolean;
}

export function ChangePasswordDialog({
  open,
  onClose,
  firstLogin,
}: ChangePasswordDialogProps) {
  const { user, setSession, accessToken } = useSession();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api<UserItem>("/users/me/password", {
        method: "POST",
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        },
      }),
    onSuccess: (updated) => {
      // Sync session so mustChangePassword is now false.
      if (user && accessToken) {
        setSession(
          {
            ...user,
            mustChangePassword: false,
          },
          accessToken,
        );
      }
      form.reset();
      setError(null);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog
      open={open}
      onClose={firstLogin ? () => {} : onClose}
      title={firstLogin ? "Criar sua nova senha" : "Alterar senha"}
    >
      {firstLogin && (
        <p className="mb-4 text-sm text-body">
          Esta é a sua primeira vez acessando o sistema. Recomendamos que você
          troque a senha temporária definida pelo administrador.
        </p>
      )}
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((data) => {
          setError(null);
          mutation.mutate(data);
        })}
        noValidate
      >
        {error && <ErrorState message={error} />}
        <PasswordField
          label="Senha atual"
          autoComplete="current-password"
          error={form.formState.errors.currentPassword?.message}
          {...form.register("currentPassword")}
        />
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          error={form.formState.errors.newPassword?.message}
          {...form.register("newPassword")}
        />
        <PasswordField
          label="Confirmar nova senha"
          autoComplete="new-password"
          error={form.formState.errors.confirmPassword?.message}
          {...form.register("confirmPassword")}
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {firstLogin ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Mudar depois
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="submit" loading={mutation.isPending}>
            {firstLogin ? "Salvar nova senha" : "Alterar senha"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
