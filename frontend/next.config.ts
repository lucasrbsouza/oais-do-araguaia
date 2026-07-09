import type { NextConfig } from "next";

// NEXT_PUBLIC_DEMO=1 → export estático (protótipo no GitHub Pages,
// backend simulado no navegador). Sem a flag → build standalone (Docker).
const isDemo = process.env.NEXT_PUBLIC_DEMO === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: isDemo ? "export" : "standalone",
  ...(basePath ? { basePath } : {}),
  ...(isDemo ? { trailingSlash: true, images: { unoptimized: true } } : {}),
};

export default nextConfig;
