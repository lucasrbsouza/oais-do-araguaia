"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import type { AuditLogItem } from "@/lib/types";
import { actionInfo, detailFields, entityLabel, formatDateTime } from "./audit-labels";

interface AuditDetailDialogProps {
  log: AuditLogItem | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline-soft py-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

export function AuditDetailDialog({ log, onClose }: AuditDetailDialogProps) {
  if (!log) return null;

  const info = actionInfo(log);
  const fields = detailFields(log);

  return (
    <Dialog open onClose={onClose} title={info.label}>
      <div className="space-y-5">
        <div className="rounded-md bg-surface-soft p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={info.tone}>{info.label}</Badge>
            <span className="text-sm text-muted">em {entityLabel(log.entity)}</span>
          </div>
          <p className="mt-2 text-sm text-body">
            {log.user ? (
              <>
                <span className="font-medium text-ink">{log.user.name}</span> ({log.user.email})
              </>
            ) : (
              <span className="font-medium text-ink">Usuário não identificado</span>
            )}{" "}
            em {formatDateTime(log.createdAt)}.
          </p>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold text-ink">O que foi registrado</h3>
          {fields.length > 0 ? (
            <div>
              {fields.map((field) => (
                <Row key={field.key} label={field.label} value={field.value} />
              ))}
            </div>
          ) : (
            <p className="py-2 text-sm text-muted">
              Esta ação não guardou informações adicionais.
            </p>
          )}
        </div>

        <details className="rounded-md border border-hairline">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted">
            Informações técnicas
          </summary>
          <div className="px-3 pb-2">
            <Row label="Endereço de IP" value={log.ip ?? "Não registrado"} />
            <Row
              label="Código do registro"
              value={
                <code className="break-all text-xs text-muted">{log.entityId ?? "—"}</code>
              }
            />
            <Row
              label="Identificador da ação"
              value={<code className="break-all text-xs text-muted">{log.action}</code>}
            />
          </div>
        </details>
      </div>
    </Dialog>
  );
}
