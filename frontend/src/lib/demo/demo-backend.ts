/**
 * Backend simulado para o protótipo estático (GitHub Pages).
 * Implementa em memória (com persistência em localStorage) os endpoints
 * que a UI consome, incluindo o cálculo de rateio (mesma regra do backend:
 * comum por peso adulto 1,0 / criança 0,5; álcool só entre consumidores;
 * arredondamento pelo método do maior resto).
 */
import type {
  ChaletPaymentSummary,
  ChaletStatus,
  DashboardSummary,
  EventReport,
  EventStatus,
  PurchaseCategory,
  Role,
  SessionUser,
} from "@/lib/types";

const STORAGE_KEY = "oais-demo-db-v1";
const SESSION_KEY = "oais-demo-session-v1";
/** Pool de ids pré-gerados no export estático (generateStaticParams). */
const MAX_EVENTS = 30;

export class DemoApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface DbUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

interface DbChalet {
  id: string;
  number: number;
  name: string;
  ownerId: string | null;
  status: ChaletStatus;
}

interface DbEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
}

interface DbReservation {
  id: string;
  eventId: string;
  chaletId: string;
  responsibleId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  alcoholConsumers: number;
  notes: string | null;
  status: "ACTIVE" | "CANCELLED";
}

interface DbPurchase {
  id: string;
  eventId: string;
  date: string;
  description: string;
  category: PurchaseCategory;
  amountCents: number;
  responsibleId: string;
  receiptDataUrl: string | null;
}

interface DbSettlementItem {
  chaletId: string;
  commonCents: number;
  alcoholCents: number;
  totalCents: number;
}

interface DbSettlement {
  eventId: string;
  computedAt: string;
  items: DbSettlementItem[];
}

interface DbPayment {
  id: string;
  eventId: string;
  chaletId: string;
  date: string;
  amountCents: number;
  notes: string | null;
}

interface Db {
  users: DbUser[];
  chalets: DbChalet[];
  events: DbEvent[];
  reservations: DbReservation[];
  purchases: DbPurchase[];
  settlements: DbSettlement[];
  payments: DbPayment[];
  eventSeq: number;
}

const uid = (): string => Math.random().toString(36).slice(2, 10);

function seed(): Db {
  const users: DbUser[] = [
    {
      id: "u-admin",
      name: "Administrador (demo)",
      email: "admin@demo.com",
      password: "demo1234",
      role: "ADMIN",
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "u-dono",
      name: "João Proprietário (demo)",
      email: "dono@demo.com",
      password: "demo1234",
      role: "OWNER",
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];
  const chalets: DbChalet[] = Array.from({ length: 11 }, (_, i) => ({
    id: `c${i + 1}`,
    number: i + 1,
    name: `Chalé ${String(i + 1).padStart(2, "0")}`,
    ownerId: i === 0 ? "u-dono" : null,
    status: "FREE" as ChaletStatus,
  }));

  const friday = nextFriday();
  const sunday = addDays(friday, 2);
  const events: DbEvent[] = [
    {
      id: "e1",
      name: "Final de Semana (exemplo)",
      startDate: friday,
      endDate: sunday,
      status: "OPEN",
    },
  ];
  const reservations: DbReservation[] = [
    {
      id: uid(),
      eventId: "e1",
      chaletId: "c1",
      responsibleId: "u-dono",
      checkIn: friday,
      checkOut: sunday,
      adults: 2,
      children: 2,
      alcoholConsumers: 2,
      notes: null,
      status: "ACTIVE",
    },
    {
      id: uid(),
      eventId: "e1",
      chaletId: "c2",
      responsibleId: "u-admin",
      checkIn: friday,
      checkOut: sunday,
      adults: 3,
      children: 0,
      alcoholConsumers: 0,
      notes: null,
      status: "ACTIVE",
    },
  ];
  const purchases: DbPurchase[] = [
    {
      id: uid(),
      eventId: "e1",
      date: friday,
      description: "Compras do mercado",
      category: "GROCERY",
      amountCents: 45000,
      responsibleId: "u-admin",
      receiptDataUrl: null,
    },
    {
      id: uid(),
      eventId: "e1",
      date: friday,
      description: "Cerveja e vinho",
      category: "ALCOHOL",
      amountCents: 21000,
      responsibleId: "u-dono",
      receiptDataUrl: null,
    },
  ];

  return {
    users,
    chalets,
    events,
    reservations,
    purchases,
    settlements: [],
    payments: [],
    eventSeq: 1,
  };
}

function nextFriday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function loadDb(): Db {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    // storage corrompido — recomeça
  }
  const db = seed();
  saveDb(db);
  return db;
}

function saveDb(db: Db): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// ── Sessão ──────────────────────────────────────────────────────────

export function demoLogin(email: string, password: string): SessionUser {
  const db = loadDb();
  const user = db.users.find((u) => u.email === email && u.active);
  if (!user || user.password !== password) {
    throw new DemoApiError(401, "Credenciais inválidas. Use admin@demo.com / demo1234.");
  }
  const session: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function demoSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function demoLogout(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

// ── Rateio (mesma regra do domínio) ─────────────────────────────────

function allocateByWeights(totalCents: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight === 0) {
    if (totalCents > 0) {
      throw new DemoApiError(422, "Não é possível ratear um valor sem participantes.");
    }
    return weights.map(() => 0);
  }
  const shares = weights.map((weight, index) => ({
    index,
    floor: Math.floor((totalCents * weight) / totalWeight),
    remainder: (totalCents * weight) % totalWeight,
  }));
  let leftover = totalCents - shares.reduce((s, x) => s + x.floor, 0);
  for (const share of [...shares].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  )) {
    if (leftover === 0) break;
    share.floor += 1;
    leftover -= 1;
  }
  return shares.map((s) => s.floor);
}

function computeSettlement(db: Db, eventId: string): DbSettlement {
  const reservations = db.reservations.filter(
    (r) => r.eventId === eventId && r.status === "ACTIVE",
  );
  const purchases = db.purchases.filter((p) => p.eventId === eventId);
  const commonTotal = purchases
    .filter((p) => p.category !== "ALCOHOL")
    .reduce((s, p) => s + p.amountCents, 0);
  const alcoholTotal = purchases
    .filter((p) => p.category === "ALCOHOL")
    .reduce((s, p) => s + p.amountCents, 0);

  const guestWeights = reservations.map((r) => r.adults * 10 + r.children * 5);
  const alcoholWeights = reservations.map((r) => r.alcoholConsumers);

  if (commonTotal > 0 && guestWeights.every((w) => w === 0)) {
    throw new DemoApiError(
      422,
      "Há despesas comuns, mas nenhuma reserva com hóspedes neste evento.",
    );
  }
  if (alcoholTotal > 0 && alcoholWeights.every((w) => w === 0)) {
    throw new DemoApiError(
      422,
      "Há despesas com bebidas alcoólicas, mas nenhum consumidor marcado nas reservas.",
    );
  }

  const commonShares = allocateByWeights(commonTotal, guestWeights);
  const alcoholShares = allocateByWeights(alcoholTotal, alcoholWeights);

  return {
    eventId,
    computedAt: new Date().toISOString(),
    items: reservations.map((r, i) => ({
      chaletId: r.chaletId,
      commonCents: commonShares[i],
      alcoholCents: alcoholShares[i],
      totalCents: commonShares[i] + alcoholShares[i],
    })),
  };
}

// ── Mapeadores de resposta (mesmo shape da API real) ────────────────

const chaletResponse = (db: Db, c: DbChalet) => ({
  id: c.id,
  number: c.number,
  name: c.name,
  status: c.status,
  owner: c.ownerId
    ? { id: c.ownerId, name: db.users.find((u) => u.id === c.ownerId)?.name ?? "?" }
    : null,
});

const reservationResponse = (db: Db, r: DbReservation) => {
  const chalet = db.chalets.find((c) => c.id === r.chaletId);
  return {
    id: r.id,
    eventId: r.eventId,
    chalet: {
      id: r.chaletId,
      number: chalet?.number ?? 0,
      name: chalet?.name ?? "?",
      ownerId: chalet?.ownerId ?? null,
    },
    responsible: {
      id: r.responsibleId,
      name: db.users.find((u) => u.id === r.responsibleId)?.name ?? "?",
    },
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    adults: r.adults,
    children: r.children,
    alcoholConsumers: r.alcoholConsumers,
    notes: r.notes,
    status: r.status,
  };
};

const purchaseResponse = (db: Db, p: DbPurchase) => ({
  id: p.id,
  eventId: p.eventId,
  date: p.date,
  description: p.description,
  category: p.category,
  amountCents: p.amountCents,
  responsible: {
    id: p.responsibleId,
    name: db.users.find((u) => u.id === p.responsibleId)?.name ?? "?",
  },
  hasReceipt: p.receiptDataUrl !== null,
});

const settlementView = (db: Db, s: DbSettlement) => {
  const items = s.items.map((item) => {
    const chalet = db.chalets.find((c) => c.id === item.chaletId);
    return {
      chaletId: item.chaletId,
      chaletNumber: chalet?.number ?? 0,
      chaletName: chalet?.name ?? "?",
      commonCents: item.commonCents,
      alcoholCents: item.alcoholCents,
      totalCents: item.totalCents,
    };
  });
  return {
    eventId: s.eventId,
    strategy: "weighted-common+alcohol-consumers",
    computedAt: s.computedAt,
    commonTotalCents: items.reduce((x, i) => x + i.commonCents, 0),
    alcoholTotalCents: items.reduce((x, i) => x + i.alcoholCents, 0),
    totalCents: items.reduce((x, i) => x + i.totalCents, 0),
    items,
  };
};

const derivePaymentStatus = (owed: number, paid: number) =>
  paid <= 0 && owed > 0 ? "PENDING" : paid < owed ? "PARTIAL" : "PAID";

const userResponse = (u: DbUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt,
});

// ── Roteador ────────────────────────────────────────────────────────

interface DemoRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: Record<string, unknown>;
}

function requireEventOpen(db: Db, eventId: string): DbEvent {
  const event = db.events.find((e) => e.id === eventId);
  if (!event) throw new DemoApiError(404, "Evento não encontrado.");
  if (event.status === "CLOSED") {
    throw new DemoApiError(409, "Evento encerrado: alterações bloqueadas.");
  }
  return event;
}

export function demoApi(pathWithQuery: string, method: string, body?: unknown): unknown {
  const [path, queryString = ""] = pathWithQuery.split("?");
  const req: DemoRequest = {
    method,
    path,
    query: new URLSearchParams(queryString),
    body: (body ?? {}) as Record<string, unknown>,
  };
  const db = loadDb();
  const result = route(db, req);
  saveDb(db);
  return result;
}

function route(db: Db, req: DemoRequest): unknown {
  const { method, path, query, body } = req;
  const user = demoSession();
  if (!user) throw new DemoApiError(401, "Sessão expirada. Faça login novamente.");
  const isAdmin = user.role === "ADMIN";
  const seg = path.split("/").filter(Boolean);

  // ── Chalés ──
  if (path === "/chalets" && method === "GET") {
    return db.chalets
      .slice()
      .sort((a, b) => a.number - b.number)
      .map((c) => chaletResponse(db, c));
  }
  if (path === "/chalets" && method === "POST") {
    if (db.chalets.some((c) => c.number === body.number)) {
      throw new DemoApiError(409, `Já existe um chalé com o número ${String(body.number)}.`);
    }
    const chalet: DbChalet = {
      id: `c-${uid()}`,
      number: Number(body.number),
      name: String(body.name),
      ownerId: (body.ownerId as string) || null,
      status: "FREE",
    };
    db.chalets.push(chalet);
    return chaletResponse(db, chalet);
  }
  if (seg[0] === "chalets" && seg.length === 2) {
    const chalet = db.chalets.find((c) => c.id === seg[1]);
    if (!chalet) throw new DemoApiError(404, "Chalé não encontrado.");
    if (method === "PATCH") {
      if (!isAdmin && chalet.ownerId !== user.id) {
        throw new DemoApiError(403, "Você só pode editar o seu próprio chalé.");
      }
      if (body.name) chalet.name = String(body.name);
      if (body.status) chalet.status = body.status as ChaletStatus;
      if (body.ownerId !== undefined && isAdmin) {
        chalet.ownerId = (body.ownerId as string) || null;
      }
      return chaletResponse(db, chalet);
    }
    if (method === "DELETE") {
      const hasHistory =
        db.reservations.some((r) => r.chaletId === chalet.id) ||
        db.payments.some((p) => p.chaletId === chalet.id) ||
        db.settlements.some((s) => s.items.some((i) => i.chaletId === chalet.id));
      if (hasHistory) {
        throw new DemoApiError(
          409,
          "Este chalé possui reservas, rateios ou pagamentos e não pode ser excluído.",
        );
      }
      db.chalets = db.chalets.filter((c) => c.id !== chalet.id);
      return undefined;
    }
  }

  // ── Eventos ──
  if (path === "/events" && method === "GET") {
    const status = query.get("status");
    let events = db.events.slice();
    if (status) events = events.filter((e) => e.status === status);
    events.sort((a, b) => b.startDate.localeCompare(a.startDate));
    return {
      data: events.map((e) => ({
        ...e,
        reservationCount: db.reservations.filter(
          (r) => r.eventId === e.id && r.status === "ACTIVE",
        ).length,
        purchaseTotalCents: db.purchases
          .filter((p) => p.eventId === e.id)
          .reduce((s, p) => s + p.amountCents, 0),
        hasSettlement: db.settlements.some((s) => s.eventId === e.id),
      })),
      total: events.length,
      page: 1,
      perPage: 100,
    };
  }
  if (path === "/events" && method === "POST") {
    if (db.eventSeq >= MAX_EVENTS) {
      throw new DemoApiError(409, "Limite de eventos do protótipo atingido.");
    }
    const start = String(body.startDate).slice(0, 10);
    const end = String(body.endDate).slice(0, 10);
    if (db.events.some((e) => e.startDate <= end && start <= e.endDate)) {
      throw new DemoApiError(409, "Já existe um evento neste período.");
    }
    db.eventSeq += 1;
    const event: DbEvent = {
      id: `e${db.eventSeq}`,
      name: String(body.name),
      startDate: start,
      endDate: end,
      status: "OPEN",
    };
    db.events.push(event);
    return event;
  }
  if (seg[0] === "events" && seg.length === 2 && method === "GET") {
    const event = db.events.find((e) => e.id === seg[1]);
    if (!event) throw new DemoApiError(404, "Evento não encontrado.");
    return event;
  }
  if (seg[0] === "events" && seg[2] === "close" && method === "POST") {
    const event = requireEventOpen(db, seg[1]);
    const settlement = computeSettlement(db, event.id);
    db.settlements = db.settlements.filter((s) => s.eventId !== event.id);
    db.settlements.push(settlement);
    event.status = "CLOSED";
    return event;
  }
  if (seg[0] === "events" && seg[2] === "reopen" && method === "POST") {
    const event = db.events.find((e) => e.id === seg[1]);
    if (!event) throw new DemoApiError(404, "Evento não encontrado.");
    event.status = "OPEN";
    return event;
  }

  // ── Rateio ──
  if (seg[0] === "events" && seg[2] === "settlement") {
    const eventId = seg[1];
    if (seg[3] === "calculate" && method === "POST") {
      requireEventOpen(db, eventId);
      const settlement = computeSettlement(db, eventId);
      db.settlements = db.settlements.filter((s) => s.eventId !== eventId);
      db.settlements.push(settlement);
      return settlementView(db, settlement);
    }
    if (method === "GET") {
      const settlement = db.settlements.find((s) => s.eventId === eventId);
      if (!settlement) {
        throw new DemoApiError(404, "Rateio ainda não calculado para este evento.");
      }
      return settlementView(db, settlement);
    }
  }

  // ── Pagamentos ──
  if (seg[0] === "events" && seg[2] === "payments" && method === "GET") {
    const settlement = db.settlements.find((s) => s.eventId === seg[1]);
    if (!settlement) {
      throw new DemoApiError(404, "Rateio ainda não calculado para este evento.");
    }
    const view: ChaletPaymentSummary[] = settlementView(db, settlement).items.map((item) => {
      const payments = db.payments.filter(
        (p) => p.eventId === seg[1] && p.chaletId === item.chaletId,
      );
      const paidCents = payments.reduce((s, p) => s + p.amountCents, 0);
      return {
        chaletId: item.chaletId,
        chaletNumber: item.chaletNumber,
        chaletName: item.chaletName,
        owedCents: item.totalCents,
        paidCents,
        status: derivePaymentStatus(item.totalCents, paidCents),
        payments: payments.map((p) => ({
          id: p.id,
          date: p.date,
          amountCents: p.amountCents,
          notes: p.notes,
        })),
      };
    });
    return view;
  }
  if (path === "/payments" && method === "POST") {
    db.payments.push({
      id: uid(),
      eventId: String(body.eventId),
      chaletId: String(body.chaletId),
      date: String(body.date).slice(0, 10),
      amountCents: Number(body.amountCents),
      notes: (body.notes as string) ?? null,
    });
    return db.payments[db.payments.length - 1];
  }

  // ── Reservas ──
  if (path === "/reservations" && method === "GET") {
    let list = db.reservations.slice();
    const eventId = query.get("eventId");
    const from = query.get("from");
    const to = query.get("to");
    if (eventId) list = list.filter((r) => r.eventId === eventId);
    if (from) list = list.filter((r) => r.checkOut >= from.slice(0, 10));
    if (to) list = list.filter((r) => r.checkIn <= to.slice(0, 10));
    list.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    return list.map((r) => reservationResponse(db, r));
  }
  if (path === "/reservations" && method === "POST") {
    const event = requireEventOpen(db, String(body.eventId));
    const chalet = db.chalets.find((c) => c.id === body.chaletId);
    if (!chalet) throw new DemoApiError(404, "Chalé não encontrado.");
    if (!isAdmin && chalet.ownerId !== user.id) {
      throw new DemoApiError(403, "Você só pode reservar o seu próprio chalé.");
    }
    const checkIn = String(body.checkIn).slice(0, 10);
    const checkOut = String(body.checkOut).slice(0, 10);
    if (checkIn < event.startDate || checkOut > event.endDate || checkOut < checkIn) {
      throw new DemoApiError(422, "Entrada e saída devem estar dentro do período do evento.");
    }
    if (
      db.reservations.some(
        (r) => r.eventId === event.id && r.chaletId === chalet.id && r.status === "ACTIVE",
      )
    ) {
      throw new DemoApiError(409, "Este chalé já possui reserva ativa neste evento.");
    }
    const reservation: DbReservation = {
      id: uid(),
      eventId: event.id,
      chaletId: chalet.id,
      responsibleId: user.id,
      checkIn,
      checkOut,
      adults: Number(body.adults),
      children: Number(body.children),
      alcoholConsumers: Number(body.alcoholConsumers),
      notes: (body.notes as string) ?? null,
      status: "ACTIVE",
    };
    db.reservations.push(reservation);
    return reservationResponse(db, reservation);
  }
  if (seg[0] === "reservations" && seg.length === 2 && method === "DELETE") {
    const reservation = db.reservations.find((r) => r.id === seg[1]);
    if (!reservation) throw new DemoApiError(404, "Reserva não encontrada.");
    requireEventOpen(db, reservation.eventId);
    reservation.status = "CANCELLED";
    return reservationResponse(db, reservation);
  }

  // ── Compras ──
  if (path === "/purchases" && method === "GET") {
    let list = db.purchases.slice();
    const eventId = query.get("eventId");
    if (eventId) list = list.filter((p) => p.eventId === eventId);
    list.sort((a, b) => b.date.localeCompare(a.date));
    return list.map((p) => purchaseResponse(db, p));
  }
  if (path === "/purchases" && method === "POST") {
    requireEventOpen(db, String(body.eventId));
    const purchase: DbPurchase = {
      id: uid(),
      eventId: String(body.eventId),
      date: String(body.date).slice(0, 10),
      description: String(body.description),
      category: body.category as PurchaseCategory,
      amountCents: Number(body.amountCents),
      responsibleId: user.id,
      receiptDataUrl: null,
    };
    db.purchases.push(purchase);
    return purchaseResponse(db, purchase);
  }
  if (seg[0] === "purchases" && seg.length === 2 && method === "DELETE") {
    const purchase = db.purchases.find((p) => p.id === seg[1]);
    if (!purchase) throw new DemoApiError(404, "Compra não encontrada.");
    requireEventOpen(db, purchase.eventId);
    db.purchases = db.purchases.filter((p) => p.id !== seg[1]);
    return undefined;
  }

  // ── Usuários ──
  if (path === "/users" && method === "GET") {
    return db.users.map(userResponse);
  }
  if (path === "/users" && method === "POST") {
    if (db.users.some((u) => u.email === body.email)) {
      throw new DemoApiError(409, "Já existe um usuário com este e-mail.");
    }
    const created: DbUser = {
      id: `u-${uid()}`,
      name: String(body.name),
      email: String(body.email),
      password: String(body.password),
      role: body.role as Role,
      active: true,
      createdAt: new Date().toISOString(),
    };
    db.users.push(created);
    return userResponse(created);
  }
  if (seg[0] === "users" && seg.length === 2 && method === "PATCH") {
    const target = db.users.find((u) => u.id === seg[1]);
    if (!target) throw new DemoApiError(404, "Usuário não encontrado.");
    if (body.active !== undefined) target.active = Boolean(body.active);
    if (body.name) target.name = String(body.name);
    return userResponse(target);
  }

  // ── Relatório ──
  if (seg[0] === "reports" && seg[1] === "events" && method === "GET") {
    const event = db.events.find((e) => e.id === seg[2]);
    if (!event) throw new DemoApiError(404, "Evento não encontrado.");
    const reservations = db.reservations.filter(
      (r) => r.eventId === event.id && r.status === "ACTIVE",
    );
    const purchases = db.purchases.filter((p) => p.eventId === event.id);
    const byCategory = new Map<PurchaseCategory, { totalCents: number; count: number }>();
    for (const p of purchases) {
      const entry = byCategory.get(p.category) ?? { totalCents: 0, count: 0 };
      entry.totalCents += p.amountCents;
      entry.count += 1;
      byCategory.set(p.category, entry);
    }
    const totalCents = purchases.reduce((s, p) => s + p.amountCents, 0);
    const alcoholTotalCents = byCategory.get("ALCOHOL")?.totalCents ?? 0;
    const settlement = db.settlements.find((s) => s.eventId === event.id);
    const report: EventReport = {
      event: { ...event },
      guests: {
        adults: reservations.reduce((s, r) => s + r.adults, 0),
        children: reservations.reduce((s, r) => s + r.children, 0),
        alcoholConsumers: reservations.reduce((s, r) => s + r.alcoholConsumers, 0),
      },
      purchasesByCategory: [...byCategory.entries()].map(([category, entry]) => ({
        category,
        ...entry,
      })),
      commonTotalCents: totalCents - alcoholTotalCents,
      alcoholTotalCents,
      totalCents,
      settlement: settlement
        ? settlementView(db, settlement).items.map((item) => {
            const paid = db.payments
              .filter((p) => p.eventId === event.id && p.chaletId === item.chaletId)
              .reduce((s, p) => s + p.amountCents, 0);
            return {
              chaletNumber: item.chaletNumber,
              chaletName: item.chaletName,
              commonCents: item.commonCents,
              alcoholCents: item.alcoholCents,
              totalCents: item.totalCents,
              paidCents: paid,
              paymentStatus: derivePaymentStatus(item.totalCents, paid),
            };
          })
        : null,
    };
    return report;
  }

  // ── Dashboard ──
  if (path === "/dashboard" && method === "GET") {
    const today = new Date().toISOString().slice(0, 10);
    const lastEvent = db.events
      .slice()
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    let lastEventSummary: DashboardSummary["lastEvent"] = null;
    if (lastEvent) {
      const settlement = db.settlements.find((s) => s.eventId === lastEvent.id);
      const items = settlement ? settlementView(db, settlement).items : [];
      const statuses = items.map((item) => {
        const paid = db.payments
          .filter((p) => p.eventId === lastEvent.id && p.chaletId === item.chaletId)
          .reduce((s, p) => s + p.amountCents, 0);
        return derivePaymentStatus(item.totalCents, paid);
      });
      lastEventSummary = {
        ...lastEvent,
        purchaseTotalCents: db.purchases
          .filter((p) => p.eventId === lastEvent.id)
          .reduce((s, p) => s + p.amountCents, 0),
        settlementTotalCents: settlement
          ? items.reduce((s, i) => s + i.totalCents, 0)
          : null,
        pendingChalets: statuses.filter((s) => s !== "PAID").length,
        paidChalets: statuses.filter((s) => s === "PAID").length,
      };
    }
    const summary: DashboardSummary = {
      chalets: {
        total: db.chalets.length,
        occupied: db.chalets.filter((c) => c.status === "OCCUPIED").length,
        reserved: db.chalets.filter((c) => c.status === "RESERVED").length,
        free: db.chalets.filter((c) => c.status === "FREE").length,
      },
      upcomingReservations: db.reservations
        .filter((r) => r.status === "ACTIVE" && r.checkOut >= today)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        .slice(0, 10)
        .map((r) => {
          const chalet = db.chalets.find((c) => c.id === r.chaletId);
          return {
            id: r.id,
            chaletNumber: chalet?.number ?? 0,
            chaletName: chalet?.name ?? "?",
            responsibleName: db.users.find((u) => u.id === r.responsibleId)?.name ?? "?",
            checkIn: r.checkIn,
            checkOut: r.checkOut,
          };
        }),
      lastEvent: lastEventSummary,
    };
    return summary;
  }

  throw new DemoApiError(404, `Endpoint não disponível no protótipo: ${method} ${path}`);
}

// ── Comprovantes ────────────────────────────────────────────────────

export async function demoAttachReceipt(purchaseId: string, file: File): Promise<unknown> {
  const db = loadDb();
  const purchase = db.purchases.find((p) => p.id === purchaseId);
  if (!purchase) throw new DemoApiError(404, "Compra não encontrada.");
  purchase.receiptDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
  saveDb(db);
  return purchaseResponse(db, purchase);
}

export function demoReceiptUrl(purchaseId: string): string | null {
  const db = loadDb();
  return db.purchases.find((p) => p.id === purchaseId)?.receiptDataUrl ?? null;
}
