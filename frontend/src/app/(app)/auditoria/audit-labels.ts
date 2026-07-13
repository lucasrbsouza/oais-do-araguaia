import { formatCents, formatDate } from "@/lib/format";
import {
  CATEGORY_LABELS,
  CHALET_STATUS_LABELS,
  type AuditLogItem,
  type ChaletStatus,
  type PurchaseCategory,
} from "@/lib/types";

export type Tone = "neutral" | "success" | "warning" | "danger";

/** Rótulo em português + tom visual para cada ação registrada. */
export const ACTION_INFO: Record<string, { label: string; tone: Tone }> = {
  AUTH_LOGIN: { label: "Login", tone: "success" },
  AUTH_LOGOUT: { label: "Logout", tone: "neutral" },
  AUTH_LOGIN_FAILED: { label: "Tentativa de login falhou", tone: "danger" },

  USER_CREATED: { label: "Usuário criado", tone: "success" },
  USER_UPDATED: { label: "Usuário atualizado", tone: "neutral" },
  USER_DELETED: { label: "Usuário excluído", tone: "danger" },
  PROFILE_UPDATED: { label: "Perfil atualizado", tone: "neutral" },
  PASSWORD_CHANGED: { label: "Senha alterada", tone: "warning" },
  AVATAR_UPDATED: { label: "Foto de perfil alterada", tone: "neutral" },

  CHALET_CREATED: { label: "Chalé criado", tone: "success" },
  CHALET_UPDATED: { label: "Chalé atualizado", tone: "neutral" },
  CHALET_DELETED: { label: "Chalé excluído", tone: "danger" },

  EVENT_CREATED: { label: "Evento criado", tone: "success" },
  EVENT_UPDATED: { label: "Evento atualizado", tone: "neutral" },
  EVENT_CANCELLED: { label: "Evento cancelado", tone: "warning" },
  EVENT_CLOSED: { label: "Evento encerrado", tone: "neutral" },
  EVENT_REOPENED: { label: "Evento reaberto", tone: "neutral" },
  EVENT_DELETED: { label: "Evento excluído", tone: "danger" },

  RESERVATION_CREATED: { label: "Reserva criada", tone: "success" },
  RESERVATION_UPDATED: { label: "Reserva editada", tone: "neutral" },
  RESERVATION_CANCELLED: { label: "Reserva cancelada", tone: "warning" },
  RESERVATION_DELETED: { label: "Reserva excluída", tone: "danger" },

  PURCHASE_CREATED: { label: "Compra registrada", tone: "success" },
  PURCHASE_UPDATED: { label: "Compra alterada", tone: "neutral" },
  PURCHASE_DELETED: { label: "Compra excluída", tone: "danger" },
  PURCHASE_RECEIPT_ATTACHED: { label: "Comprovante anexado", tone: "neutral" },

  SETTLEMENT_CALCULATED: { label: "Rateio calculado", tone: "neutral" },
  SETTLEMENT_AUTO_CONFIGURED: {
    label: "Rateio automático configurado",
    tone: "neutral",
  },

  PAYMENT_REGISTERED: { label: "Pagamento registrado", tone: "success" },
  RECEIVABLE_SETTLED: { label: "Devolução registrada", tone: "success" },

  REPORT_EXPORTED: { label: "Relatório exportado", tone: "neutral" },
};

export const ENTITY_LABELS: Record<string, string> = {
  Auth: "Acesso",
  User: "Usuário",
  Chalet: "Chalé",
  Event: "Evento",
  Reservation: "Reserva",
  Purchase: "Compra",
  Settlement: "Rateio",
  Payment: "Pagamento",
  Receivable: "Crédito",
  Report: "Relatório",
  // Registros antigos guardavam o nome do controller (no plural).
  Users: "Usuário",
  Chalets: "Chalé",
  Events: "Evento",
  Reservations: "Reserva",
  Purchases: "Compra",
  Payments: "Pagamento",
  Reports: "Relatório",
};

/** Grupos do seletor de ação, na ordem em que aparecem. */
export const ACTION_GROUPS: Array<{ label: string; actions: string[] }> = [
  { label: "Acesso", actions: ["AUTH_LOGIN", "AUTH_LOGOUT", "AUTH_LOGIN_FAILED"] },
  {
    label: "Reservas",
    actions: [
      "RESERVATION_CREATED",
      "RESERVATION_UPDATED",
      "RESERVATION_CANCELLED",
      "RESERVATION_DELETED",
    ],
  },
  {
    label: "Compras",
    actions: [
      "PURCHASE_CREATED",
      "PURCHASE_UPDATED",
      "PURCHASE_DELETED",
      "PURCHASE_RECEIPT_ATTACHED",
    ],
  },
  {
    label: "Eventos",
    actions: [
      "EVENT_CREATED",
      "EVENT_UPDATED",
      "EVENT_CANCELLED",
      "EVENT_CLOSED",
      "EVENT_REOPENED",
      "EVENT_DELETED",
    ],
  },
  {
    label: "Rateio e pagamentos",
    actions: [
      "SETTLEMENT_CALCULATED",
      "SETTLEMENT_AUTO_CONFIGURED",
      "PAYMENT_REGISTERED",
      "RECEIVABLE_SETTLED",
    ],
  },
  {
    label: "Usuários e chalés",
    actions: [
      "USER_CREATED",
      "USER_UPDATED",
      "USER_DELETED",
      "PROFILE_UPDATED",
      "PASSWORD_CHANGED",
      "AVATAR_UPDATED",
      "CHALET_CREATED",
      "CHALET_UPDATED",
      "CHALET_DELETED",
    ],
  },
  { label: "Relatórios", actions: ["REPORT_EXPORTED"] },
];

/**
 * Registros antigos guardavam a rota crua ("POST /api/users/me/avatar").
 * Traduz para algo legível a partir do método e da área.
 */
const METHOD_LABELS: Record<string, string> = {
  POST: "Cadastro",
  PUT: "Alteração",
  PATCH: "Alteração",
  DELETE: "Exclusão",
};

export function actionInfo(log: AuditLogItem): { label: string; tone: Tone } {
  const known = ACTION_INFO[log.action];
  if (known) return known;

  const method = log.action.split(" ")[0];
  const verb = METHOD_LABELS[method];
  const area = ENTITY_LABELS[log.entity];
  if (verb && area) {
    return { label: `${verb} — ${area.toLowerCase()}`, tone: "neutral" };
  }
  return { label: "Outra ação", tone: "neutral" };
}

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FIELD_LABELS: Record<string, string> = {
  event: "Evento",
  eventStart: "Início do evento",
  eventEnd: "Fim do evento",
  eventStatus: "Situação do evento",
  chalet: "Chalé",
  chaletOwner: "Proprietário do chalé",
  chaletStatus: "Situação do chalé",
  responsible: "Responsável",
  checkIn: "Entrada",
  checkOut: "Saída",
  adults: "Adultos",
  children: "Crianças",
  alcoholConsumers: "Consomem bebida alcoólica",
  reservationStatus: "Situação da reserva",
  description: "Descrição",
  category: "Categoria",
  amountCents: "Valor",
  purchaseDate: "Data da compra",
  hasReceipt: "Comprovante anexado",
  paymentDate: "Data do pagamento",
  receivableStatus: "Situação do crédito",
  totalCents: "Total do rateio",
  chaletsCount: "Chalés no rateio",
  mode: "Modo do rateio automático",
  intervalMinutes: "Intervalo (minutos)",
  fileName: "Arquivo",
  notes: "Observações",
  userName: "Nome",
  userEmail: "E-mail",
  userRole: "Perfil de acesso",
  userActive: "Situação do usuário",
  email: "E-mail informado",
  format: "Formato do arquivo",
};

/** Ordem em que os campos aparecem no detalhe, do mais para o menos relevante. */
const FIELD_ORDER = [
  "userName",
  "userEmail",
  "userRole",
  "userActive",
  "event",
  "eventStart",
  "eventEnd",
  "eventStatus",
  "chalet",
  "chaletOwner",
  "chaletStatus",
  "responsible",
  "checkIn",
  "checkOut",
  "adults",
  "children",
  "alcoholConsumers",
  "reservationStatus",
  "description",
  "category",
  "amountCents",
  "purchaseDate",
  "hasReceipt",
  "paymentDate",
  "receivableStatus",
  "totalCents",
  "chaletsCount",
  "mode",
  "intervalMinutes",
  "fileName",
  "notes",
  "email",
  "format",
];

const EVENT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberto",
  CLOSED: "Encerrado",
  CANCELLED: "Cancelado",
};

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  CANCELLED: "Cancelada",
};

const RECEIVABLE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Em aberto",
  SETTLED: "Devolvido",
};

const AUTO_MODE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  ON_PURCHASE: "A cada compra lançada",
  INTERVAL: "Por intervalo de tempo",
};

const DATE_FIELDS = new Set([
  "eventStart",
  "eventEnd",
  "checkIn",
  "checkOut",
  "purchaseDate",
  "paymentDate",
]);

const ENUM_LABELS: Record<string, Record<string, string>> = {
  eventStatus: EVENT_STATUS_LABELS,
  reservationStatus: RESERVATION_STATUS_LABELS,
  receivableStatus: RECEIVABLE_STATUS_LABELS,
  chaletStatus: CHALET_STATUS_LABELS as Record<ChaletStatus, string>,
  category: CATEGORY_LABELS as Record<PurchaseCategory, string>,
  mode: AUTO_MODE_LABELS,
};

/** Valor pronto para leitura; `null` quando não há nada a mostrar. */
function formatValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (key === "userActive") return value ? "Ativo" : "Inativo";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (key.endsWith("Cents")) return formatCents(Number(value));
  if (DATE_FIELDS.has(key)) return formatDate(String(value));
  if (key === "userRole") {
    return value === "ADMIN" ? "Administrador" : "Proprietário";
  }
  if (key === "format") return String(value).toUpperCase();

  const enumLabels = ENUM_LABELS[key];
  if (enumLabels) return enumLabels[String(value)] ?? String(value);

  return String(value);
}

export interface AuditField {
  key: string;
  label: string;
  value: string;
}

/** Todos os campos do registro, prontos para exibir no detalhe. */
export function detailFields(log: AuditLogItem): AuditField[] {
  const metadata = log.metadata ?? {};
  const keys = Object.keys(metadata).sort((a, b) => {
    const posA = FIELD_ORDER.indexOf(a);
    const posB = FIELD_ORDER.indexOf(b);
    return (posA === -1 ? FIELD_ORDER.length : posA) - (posB === -1 ? FIELD_ORDER.length : posB);
  });

  return keys.flatMap((key) => {
    const value = formatValue(key, metadata[key]);
    if (value === null) return [];
    return [{ key, label: FIELD_LABELS[key] ?? key, value }];
  });
}

/** Campos que resumem cada área na coluna "Detalhes" da tabela. */
const SUMMARY_FIELDS: Record<string, string[]> = {
  Auth: ["email"],
  User: ["userName"],
  Users: ["userName"],
  Chalet: ["chalet"],
  Chalets: ["chalet"],
  Event: ["event"],
  Events: ["event"],
  Reservation: ["chalet", "event"],
  Reservations: ["chalet", "event"],
  Purchase: ["description", "amountCents"],
  Purchases: ["description", "amountCents"],
  Settlement: ["event", "totalCents"],
  Payment: ["chalet", "amountCents"],
  Payments: ["chalet", "amountCents"],
  Receivable: ["chalet", "amountCents"],
  Report: ["format"],
  Reports: ["format"],
};

/** Resumo de uma linha; string vazia quando o registro não tem contexto. */
export function summarize(log: AuditLogItem): string {
  const metadata = log.metadata;
  if (!metadata) return "";

  const keys = [...(SUMMARY_FIELDS[log.entity] ?? [])];
  // Compra sem descrição: a categoria já diz do que se trata.
  if (keys.includes("description") && !metadata.description) {
    keys[keys.indexOf("description")] = "category";
  }

  return keys
    .map((key) => formatValue(key, metadata[key]))
    .filter((value): value is string => value !== null)
    .join(" · ");
}
