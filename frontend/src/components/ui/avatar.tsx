"use client";

import { useQuery } from "@tanstack/react-query";
import { getAvatarUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  userId: string;
  name: string;
  hasAvatar: boolean;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Foto de perfil com fallback para as iniciais do nome. */
export function UserAvatar({ userId, name, hasAvatar, className }: UserAvatarProps) {
  const { data: url } = useQuery({
    queryKey: ["avatar", userId],
    queryFn: () => getAvatarUrl(userId),
    enabled: hasAvatar,
    staleTime: 5 * 60 * 1000,
  });

  if (hasAvatar && url) {
    return (
      <img
        src={url}
        alt={`Foto de ${name}`}
        className={cn("size-10 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-strong text-sm font-semibold text-ink",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
