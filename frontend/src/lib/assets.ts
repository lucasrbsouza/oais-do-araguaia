/**
 * Caminho de arquivo público (pasta `public/`) respeitando o basePath.
 *
 * No protótipo do GitHub Pages o site vive em /oais-do-araguaia, e o Next só
 * prefixa automaticamente o que passa por <Link> e next/image — um `<img
 * src="/logo.png">` cru continua apontando para a raiz do domínio e quebra.
 * Use esta função sempre que referenciar um arquivo de `public/` na mão.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}

export const LOGO_SRC = asset("/logo-sem-fundo.png");
