export type Role = "ADMIN" | "OWNER";
export type EventStatus = "OPEN" | "CLOSED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID";
export type ChaletStatus = "FREE" | "RESERVED" | "OCCUPIED";

export const PURCHASE_CATEGORIES = [
  "GROCERY",
  "MEAT",
  "ALCOHOL",
  "SOFT_DRINKS",
  "CLEANING",
  "BAKERY",
  "ICE",
  "STAFF_DAILY",
  "OTHER",
] as const;
export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<PurchaseCategory, string> = {
  GROCERY: "Mercado",
  MEAT: "Carnes",
  ALCOHOL: "Bebidas alcoólicas",
  SOFT_DRINKS: "Refrigerantes",
  CLEANING: "Limpeza",
  BAKERY: "Padaria",
  ICE: "Gelo",
  STAFF_DAILY: "Diárias do funcionário",
  OTHER: "Outros",
};

export const CHALET_STATUS_LABELS: Record<ChaletStatus, string> = {
  FREE: "Livre",
  RESERVED: "Reservado",
  OCCUPIED: "Ocupado",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
};

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  hasAvatar: boolean;
  /** Usuário criado pelo admin ainda não trocou a senha inicial. */
  mustChangePassword: boolean;
}

export interface UserItem extends SessionUser {
  active: boolean;
  createdAt: string;
}

export interface Chalet {
  id: string;
  number: number;
  name: string;
  status: ChaletStatus;
  owner: { id: string; name: string } | null;
}

export interface EventItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
  reservationCount: number;
  purchaseTotalCents: number;
  hasSettlement: boolean;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface Reservation {
  id: string;
  eventId: string;
  chalet: { id: string; number: number; name: string; ownerId: string | null };
  responsible: { id: string; name: string };
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  alcoholConsumers: number;
  notes: string | null;
  status: "ACTIVE" | "CANCELLED";
}

export interface Purchase {
  id: string;
  eventId: string;
  date: string;
  description: string | null;
  category: PurchaseCategory;
  amountCents: number;
  responsible: { id: string; name: string };
  /** Chalé beneficiado quando a compra é um adiantamento vinculado à reserva. */
  chalet: { id: string; number: number; name: string } | null;
  hasReceipt: boolean;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export type SettlementAutoMode = "MANUAL" | "ON_PURCHASE" | "INTERVAL";

export interface SettlementAutoConfig {
  mode: SettlementAutoMode;
  intervalMinutes: number | null;
}

export interface Settlement {
  eventId: string;
  strategy: string;
  computedAt: string;
  commonTotalCents: number;
  alcoholTotalCents: number;
  totalCents: number;
  items: Array<{
    chaletId: string;
    chaletNumber: number;
    chaletName: string;
    commonCents: number;
    alcoholCents: number;
    totalCents: number;
  }>;
}

export interface ChaletPaymentSummary {
  chaletId: string;
  chaletNumber: number;
  chaletName: string;
  ownerName: string | null;
  owedCents: number;
  paidCents: number;
  /** Compras/adiantamentos lançados vinculados ao chalé. */
  advanceCents: number;
  /** Saldo devedor: devido − pago − adiantamentos (negativo = crédito). */
  balanceCents: number;
  status: PaymentStatus;
  payments: Array<{ id: string; date: string; amountCents: number; notes: string | null }>;
}

export type ReceivableStatus = "OPEN" | "SETTLED";

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  OPEN: "Em aberto",
  SETTLED: "Quitado",
};

/** Crédito gerado automaticamente no fechamento do evento. */
export interface Receivable {
  id: string;
  eventId: string;
  eventName: string;
  chaletId: string;
  chaletNumber: number;
  chaletName: string;
  amountCents: number;
  status: ReceivableStatus;
  settledAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface EventReport {
  event: { id: string; name: string; startDate: string; endDate: string; status: EventStatus };
  guests: { adults: number; children: number; alcoholConsumers: number };
  purchasesByCategory: Array<{ category: PurchaseCategory; totalCents: number; count: number }>;
  commonTotalCents: number;
  alcoholTotalCents: number;
  totalCents: number;
  settlement: Array<{
    chaletNumber: number;
    chaletName: string;
    ownerName: string | null;
    commonCents: number;
    alcoholCents: number;
    totalCents: number;
    advanceCents: number;
    paidCents: number;
    paymentStatus: PaymentStatus;
  }> | null;
}

export interface DashboardSummary {
  chalets: { total: number; occupied: number; reserved: number; free: number };
  upcomingReservations: Array<{
    id: string;
    chaletNumber: number;
    chaletName: string;
    responsibleName: string;
    checkIn: string;
    checkOut: string;
  }>;
  lastEvent: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: EventStatus;
    purchaseTotalCents: number;
    settlementTotalCents: number | null;
    pendingChalets: number;
    paidChalets: number;
  } | null;
}
