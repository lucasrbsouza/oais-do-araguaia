"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  KeyRound,
  Mail,
  Phone,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, getAvatarUrl } from "@/lib/api";
import type { UserItem } from "@/lib/types";
import { useSession } from "@/stores/session";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ChangePasswordDialog } from "@/components/ui/change-password-dialog";
import { Field, PhoneField, formatPhoneBR } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";

/* ── Schemas ─────────────────────────────────────────── */

const profileSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  phone: z.string().max(20, "Máximo 20 caracteres.").optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

/* ── Helpers ─────────────────────────────────────────── */

function formatRole(role: string): string {
  return role === "ADMIN" ? "Administrador" : "Proprietário";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/* ── Page Component ──────────────────────────────────── */

export default function ProfilePage() {
  const { user: sessionUser, setSession, accessToken } = useSession();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => api<UserItem>("/users/me"),
  });

  const { data: avatarUrl } = useQuery({
    queryKey: ["avatar", sessionUser?.id],
    queryFn: () => getAvatarUrl(sessionUser!.id),
    enabled: !!sessionUser?.hasAvatar,
    staleTime: 5 * 60 * 1000,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: profile
      ? {
          name: profile.name,
          email: profile.email,
          phone: formatPhoneBR(profile.phone ?? ""),
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProfileFormData) =>
      api<UserItem>("/users/me", {
        method: "PATCH",
        body: {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
        },
      }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      if (sessionUser && accessToken) {
        setSession(
          {
            ...sessionUser,
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
          },
          accessToken,
        );
      }
      setFormError(null);
      setFormSuccess("Dados atualizados com sucesso!");
      setTimeout(() => setFormSuccess(null), 4000);
    },
    onError: (err: Error) => {
      setFormSuccess(null);
      setFormError(err.message);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api<UserItem>("/users/me/avatar", {
        method: "POST",
        formData,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["avatar"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (sessionUser && accessToken) {
        setSession({ ...sessionUser, hasAvatar: true }, accessToken);
      }
      setAvatarError(null);
    },
    onError: (err: Error) => setAvatarError(err.message),
  });

  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setAvatarError("A imagem deve ter no máximo 2 MB.");
        return;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        setAvatarError("Formato aceito: JPEG, PNG ou WebP.");
        return;
      }
      avatarMutation.mutate(file);
    },
    [avatarMutation],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-strong" />
        <div className="h-64 animate-pulse rounded-md bg-surface-strong" />
        <div className="h-48 animate-pulse rounded-md bg-surface-strong" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <ErrorState message={(error as Error)?.message ?? "Erro ao carregar perfil."} />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-ink">Meu perfil</h1>

      {/* ── Avatar + Info Card ─────────────────────── */}
      <Card className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="relative group">
          {sessionUser?.hasAvatar && avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Foto de ${profile.name}`}
              className="size-28 rounded-full object-cover ring-4 ring-surface-strong"
            />
          ) : (
            <UserAvatar
              userId={profile.id}
              name={profile.name}
              hasAvatar={false}
              className="size-28 text-2xl ring-4 ring-surface-strong"
            />
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarMutation.isPending}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
            aria-label="Alterar foto"
          >
            <Camera className="size-6" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-xl font-bold text-ink">{profile.name}</h2>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted sm:justify-start">
            <Shield className="size-3.5" aria-hidden />
            {formatRole(profile.role)}
          </p>
          <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-muted sm:justify-start">
            <Mail className="size-3.5" aria-hidden />
            {profile.email}
          </p>
          {profile.phone && (
            <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-muted sm:justify-start">
              <Phone className="size-3.5" aria-hidden />
              {profile.phone}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Membro desde {formatDate(profile.createdAt)}
          </p>
          {avatarError && (
            <p className="mt-2 text-xs text-error">{avatarError}</p>
          )}
        </div>
      </Card>

      {/* ── Edit Form ─────────────────────────────── */}
      <Card>
        <CardTitle className="mb-4 flex items-center gap-2">
          <UserIcon className="size-4.5" aria-hidden />
          Editar dados
        </CardTitle>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((data) => {
            setFormError(null);
            setFormSuccess(null);
            updateMutation.mutate(data);
          })}
          noValidate
        >
          {formError && <ErrorState message={formError} />}
          {formSuccess && (
            <div className="rounded-sm border border-success/30 bg-green-50 px-4 py-2.5 text-sm font-medium text-success">
              {formSuccess}
            </div>
          )}
          <Field
            label="Nome"
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <Field
            label="E-mail"
            type="email"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <PhoneField
            label="Telefone"
            error={form.formState.errors.phone?.message}
            {...form.register("phone")}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              loading={updateMutation.isPending}
              disabled={!form.formState.isDirty}
            >
              Salvar alterações
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Security Card ────────────────────────── */}
      <Card>
        <CardTitle className="mb-4 flex items-center gap-2">
          <KeyRound className="size-4.5" aria-hidden />
          Segurança
        </CardTitle>
        <p className="mb-4 text-sm text-body">
          Altere sua senha de acesso ao sistema. Recomendamos usar pelo menos 8
          caracteres, combinando letras, números e símbolos.
        </p>
        <Button variant="secondary" onClick={() => setChangePasswordOpen(true)}>
          Alterar senha
        </Button>
      </Card>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  );
}
