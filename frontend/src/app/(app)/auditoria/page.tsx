"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ScrollText } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import type { AuditLogItem, Paginated, UserItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { useSession } from "@/stores/session";
import { AuditDetailDialog } from "./audit-detail-dialog";
import {
  ACTION_GROUPS,
  ACTION_INFO,
  ENTITY_LABELS,
  actionInfo,
  entityLabel,
  formatDateTime,
  summarize,
} from "./audit-labels";

const PER_PAGE = 25;

/** Áreas oferecidas no filtro (as chaves no plural são só de registros antigos). */
const FILTERABLE_ENTITIES = [
  "Auth",
  "User",
  "Chalet",
  "Event",
  "Reservation",
  "Purchase",
  "Settlement",
  "Payment",
  "Receivable",
  "Report",
];

// h-11/text-base no toque: abaixo de 16px o iOS dá zoom sozinho ao focar o campo.
const selectClass =
  "h-11 w-full rounded-sm border border-hairline bg-canvas px-2 text-base text-ink cursor-pointer sm:h-10 sm:text-sm";

export default function AuditPage() {
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);

  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (action) params.set("action", action);
  if (entity) params.set("entity", entity);
  if (from) params.set("from", `${from}T00:00:00`);
  if (to) params.set("to", `${to}T23:59:59`);
  params.set("page", String(page));
  params.set("perPage", String(PER_PAGE));

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", params.toString()],
    queryFn: () => api<Paginated<AuditLogItem>>(`/audit?${params.toString()}`),
    enabled: isAdmin,
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<UserItem[]>("/users"),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <ErrorState message="Acesso restrito: somente administradores podem ver a auditoria." />
    );
  }

  const hasFilters = Boolean(userId || action || entity || from || to);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  const resetPageAnd = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ScrollText className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink">Auditoria</h1>
          <p className="text-sm text-muted">
            Registro de tudo que acontece no sistema: quem fez, o quê e quando. Clique em uma
            linha para ver os detalhes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-end gap-3 rounded-md border border-hairline bg-canvas p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          Usuário
          <select
            value={userId}
            onChange={(e) => resetPageAnd(setUserId)(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          Ação
          <select
            value={action}
            onChange={(e) => resetPageAnd(setAction)(e.target.value)}
            className={selectClass}
          >
            <option value="">Todas</option>
            {ACTION_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.actions.map((a) => (
                  <option key={a} value={a}>
                    {ACTION_INFO[a]?.label ?? a}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          Área
          <select
            value={entity}
            onChange={(e) => resetPageAnd(setEntity)(e.target.value)}
            className={selectClass}
          >
            <option value="">Todas</option>
            {FILTERABLE_ENTITIES.map((value) => (
              <option key={value} value={value}>
                {ENTITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          De
          <input
            type="date"
            value={from}
            onChange={(e) => resetPageAnd(setFrom)(e.target.value)}
            className={selectClass}
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => resetPageAnd(setTo)(e.target.value)}
            className={selectClass}
          />
        </label>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUserId("");
              setAction("");
              setEntity("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          title="Nenhum registro encontrado"
          description={
            hasFilters
              ? "Ajuste os filtros para ver outros registros."
              : "As ações dos usuários aparecerão aqui conforme forem acontecendo."
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th className="w-40">Data e hora</Th>
                <Th>Usuário</Th>
                <Th>Ação</Th>
                <Th>Área</Th>
                <Th>Detalhes</Th>
                <Th className="w-10">
                  <span className="sr-only">Abrir detalhes</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((log) => {
                const info = actionInfo(log);
                const summary = summarize(log);
                return (
                  <tr
                    key={log.id}
                    tabIndex={0}
                    onClick={() => setSelected(log)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(log);
                      }
                    }}
                    aria-label={`Ver detalhes: ${info.label}`}
                    className="cursor-pointer hover:bg-surface-soft focus:bg-surface-soft focus:outline-none"
                  >
                    <Td label="Data e hora" className="whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </Td>
                    <Td label="Usuário">
                      {log.user ? (
                        <span className="block">
                          <span className="block font-medium text-ink">{log.user.name}</span>
                          <span className="block text-xs text-muted">{log.user.email}</span>
                        </span>
                      ) : (
                        <span className="text-muted-soft">—</span>
                      )}
                    </Td>
                    <Td label="Ação">
                      <Badge tone={info.tone}>{info.label}</Badge>
                    </Td>
                    <Td label="Área">{entityLabel(log.entity)}</Td>
                    <Td
                      label="Detalhes"
                      className="max-w-64 truncate text-xs text-muted"
                      title={summary}
                    >
                      {summary || "—"}
                    </Td>
                    <Td className="hidden text-muted-soft xl:table-cell">
                      <ChevronRight className="size-4" aria-hidden />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <span>
              {data.total} registro{data.total === 1 ? "" : "s"}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                Página {page} de {totalPages}
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <AuditDetailDialog log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
