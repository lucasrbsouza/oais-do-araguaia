/**
 * O perfil é aberto de qualquer tela (rodapé da barra lateral, ícone do topo,
 * lista de usuários), então o botão de voltar precisa saber de onde o usuário
 * veio. `history.back()` não serve: numa aba aberta direto no perfil ele joga
 * o usuário para fora do sistema.
 */
const CHAVE = "oais:ultima-rota";

/** Rota para onde voltar quando não há tela anterior conhecida. */
export const ROTA_PADRAO = "/dashboard";

/**
 * O protótipo roda com `trailingSlash: true` e a produção não, então a mesma
 * tela chega aqui como `/perfil/` ou `/perfil`. Sem normalizar, o perfil se
 * guardaria como origem de si mesmo e o botão não sairia do lugar.
 */
const normalizar = (rota: string): string => rota.replace(/\/+$/, "") || "/";

export function guardarUltimaRota(rota: string): void {
  if (typeof window === "undefined" || normalizar(rota) === "/perfil") return;
  window.sessionStorage.setItem(CHAVE, rota);
}

export function lerUltimaRota(): string {
  if (typeof window === "undefined") return ROTA_PADRAO;
  const rota = window.sessionStorage.getItem(CHAVE);
  if (!rota || normalizar(rota) === "/perfil") return ROTA_PADRAO;
  return rota;
}
