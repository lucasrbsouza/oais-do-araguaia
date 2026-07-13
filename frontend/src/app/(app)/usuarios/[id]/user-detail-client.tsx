"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, Shield } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, getAvatarUrl } from "@/lib/api";
import type { UserItem } from "@/lib/types";
import { useSession } from "@/stores/session";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";

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

export default function UserDetailClient() {
  const { id } = useParams<{ id: string }>();
  const { user: sessionUser } = useSession();

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["user-profile", id],
    queryFn: () => api<UserItem>(`/users/${id}`),
    enabled: !!id,
  });

  const { data: avatarUrl } = useQuery({
    queryKey: ["avatar", id],
    queryFn: () => getAvatarUrl(id),
    enabled: !!profile?.hasAvatar,
    staleTime: 5 * 60 * 1000,
  });

  // Redirect to own profile if viewing self
  const isSelf = sessionUser?.id === id;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-strong" />
        <div className="h-64 animate-pulse rounded-md bg-surface-strong" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? "Usuário não encontrado."}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={isSelf ? "/perfil" : "/usuarios"}
          className="rounded-full p-1.5 text-muted hover:bg-surface-soft transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold text-ink">
          {isSelf ? "Meu perfil" : `Perfil de ${profile.name}`}
        </h1>
      </div>

      <Card className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="shrink-0">
          {profile.hasAvatar && avatarUrl ? (
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
        </div>

        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div>
            <h2 className="text-xl font-bold text-ink">{profile.name}</h2>
            <div className="mt-1 flex items-center justify-center gap-2 sm:justify-start">
              <Badge tone={profile.active ? "success" : "neutral"}>
                {profile.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="flex items-center justify-center gap-1.5 text-sm text-body sm:justify-start">
              <Shield className="size-3.5 text-muted" aria-hidden />
              {formatRole(profile.role)}
            </p>
            <p className="flex items-center justify-center gap-1.5 text-sm text-body sm:justify-start">
              <Mail className="size-3.5 text-muted" aria-hidden />
              {profile.email}
            </p>
            {profile.phone && (
              <p className="flex items-center justify-center gap-1.5 text-sm text-body sm:justify-start">
                <Phone className="size-3.5 text-muted" aria-hidden />
                {profile.phone}
              </p>
            )}
          </div>

          <p className="text-xs text-muted">
            Membro desde {formatDate(profile.createdAt)}
          </p>
        </div>
      </Card>
    </div>
  );
}
