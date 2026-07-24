import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardarUltimaRota, lerUltimaRota, ROTA_PADRAO } from "./ultima-rota";

/** sessionStorage de mentira: o projeto roda os testes em node, sem DOM. */
function criarStorage() {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
  };
}

let storage: ReturnType<typeof criarStorage>;

beforeEach(() => {
  storage = criarStorage();
  vi.stubGlobal("window", { sessionStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ultima rota do botao de voltar", () => {
  it("sem nada guardado, cai na rota padrao", () => {
    expect(lerUltimaRota()).toBe(ROTA_PADRAO);
  });

  it("devolve a tela de onde o usuario veio", () => {
    guardarUltimaRota("/chales");
    expect(lerUltimaRota()).toBe("/chales");
  });

  it("o proprio perfil nunca vira origem", () => {
    guardarUltimaRota("/reservas");
    guardarUltimaRota("/perfil");
    expect(lerUltimaRota()).toBe("/reservas");
  });

  it("ignora o perfil mesmo com barra no fim (protótipo usa trailingSlash)", () => {
    guardarUltimaRota("/reservas/");
    guardarUltimaRota("/perfil/");
    expect(lerUltimaRota()).toBe("/reservas/");
  });

  it("perfil guardado por versao antiga nao trava o botao", () => {
    storage.setItem("oais:ultima-rota", "/perfil/");
    expect(lerUltimaRota()).toBe(ROTA_PADRAO);
  });

  it("guarda rota com id, como o detalhe de evento", () => {
    guardarUltimaRota("/eventos/e1");
    expect(lerUltimaRota()).toBe("/eventos/e1");
  });

  it("no servidor, sem window, nao quebra", () => {
    vi.stubGlobal("window", undefined);
    expect(() => guardarUltimaRota("/chales")).not.toThrow();
    expect(lerUltimaRota()).toBe(ROTA_PADRAO);
  });
});
