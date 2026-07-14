import { beforeEach, describe, expect, it } from "vitest";
import { DemoApiError, demoApi, demoLogin } from "./demo-backend";

/** O protótipo roda no navegador; aqui basta um localStorage de mentira. */
function stubBrowserStorage(): void {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
    writable: true,
  });
}

interface SettlementItem {
  chaletId: string;
  commonCents: number;
  alcoholCents: number;
  totalCents: number;
}
interface SettlementView {
  items: SettlementItem[];
  totalCents: number;
}
interface EventView {
  id: string;
  startDate: string;
  endDate: string;
}

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Semeia o chalé 1 com uma entrada extra e devolve o rateio recalculado. */
const reserve = (
  chaletId: string,
  eventId: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  alcoholConsumers = 0,
) =>
  demoApi("/reservations", "POST", {
    eventId,
    chaletId,
    checkIn,
    checkOut,
    adults,
    children: 0,
    alcoholConsumers,
  });

describe("rateio do protótipo (demo)", () => {
  let event: EventView;

  beforeEach(() => {
    stubBrowserStorage();
    demoLogin("admin@demo.com", "demo1234");
    event = (demoApi("/events/e1", "GET", undefined) as EventView);
  });

  it("aceita várias entradas no mesmo chalé e soma numa cota única", () => {
    // O seed já tem c1 (2 adultos + 2 crianças, 2 diárias) e c2 (3 adultos,
    // 2 diárias). Adiciona uma segunda entrada curta no c1: 1 diária.
    const saturday = addDays(event.startDate, 1);
    reserve("c1", event.id, saturday, event.endDate, 2, 1);

    const view = demoApi(
      `/events/${event.id}/settlement/calculate`,
      "POST",
      undefined,
    ) as SettlementView;

    // Três reservas ativas, mas duas cotas: o rateio é por chalé, não por entrada.
    expect(view.items).toHaveLength(2);

    // Pesos em pessoa-diária: c1 = (2a+2c)×2 + (2a)×1 = 80, c2 = (3a)×2 = 60.
    // Comum = R$ 450,00 → 25714 / 19286 (maior resto, soma exata).
    const c1 = view.items.find((i) => i.chaletId === "c1")!;
    const c2 = view.items.find((i) => i.chaletId === "c2")!;
    expect(c1.commonCents).toBe(25714);
    expect(c2.commonCents).toBe(19286);
    expect(c1.commonCents + c2.commonCents).toBe(45000);

    // Álcool = R$ 210,00, só entre consumidores: c1 tem 2×2 + 1×1 = 5, c2 tem 0.
    expect(c1.alcoholCents).toBe(21000);
    expect(c2.alcoholCents).toBe(0);

    expect(view.items.reduce((s, i) => s + i.totalCents, 0)).toBe(view.totalCents);
  });

  it("bloqueia a 4ª entrada simultânea: o chalé tem 3 suítes", () => {
    // c1 já tem 1 entrada do seed cobrindo o evento inteiro.
    reserve("c1", event.id, event.startDate, event.endDate, 1);
    reserve("c1", event.id, event.startDate, event.endDate, 1);

    expect(() =>
      reserve("c1", event.id, event.startDate, event.endDate, 1),
    ).toThrow(DemoApiError);
  });

  it("aceita entrada em sequência: quem sai libera a suíte no mesmo dia", () => {
    // Lota as 3 suítes só até o sábado…
    const saturday = addDays(event.startDate, 1);
    reserve("c2", event.id, event.startDate, saturday, 1);
    reserve("c2", event.id, event.startDate, saturday, 1);

    // …e entra no sábado, quando as anteriores já saíram.
    expect(() =>
      reserve("c2", event.id, saturday, event.endDate, 1),
    ).not.toThrow();
  });
});
