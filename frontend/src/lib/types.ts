export type Role = "ADMIN" | "OWNER";
export type EventStatus = "OPEN" | "CLOSED";
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
  chalet: { id: string; number: number; name: string };
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
  description: string;
  category: PurchaseCategory;
  amountCents: number;
  responsible: { id: string; name: string };
  hasReceipt: boolean;
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
  owedCents: number;
  paidCents: number;
  status: PaymentStatus;
  payments: Array<{ id: string; date: string; amountCents: number; notes: string | null }>;
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
    commonCents: number;
    alcoholCents: number;
    totalCents: number;
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
