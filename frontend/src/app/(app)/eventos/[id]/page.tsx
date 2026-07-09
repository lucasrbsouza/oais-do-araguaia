import { Suspense } from "react";
import EventDetailClient from "./event-detail-client";

/**
 * No export estático (protótipo/GitHub Pages) as rotas dinâmicas precisam ser
 * pré-geradas: o modo demo usa ids "e1".."e30". No deploy real (standalone),
 * qualquer id continua funcionando (dynamicParams padrão).
 */
export function generateStaticParams(): Array<{ id: string }> {
  return Array.from({ length: 30 }, (_, i) => ({ id: `e${i + 1}` }));
}

export default function EventDetailPage() {
  return (
    <Suspense fallback={null}>
      <EventDetailClient />
    </Suspense>
  );
}
