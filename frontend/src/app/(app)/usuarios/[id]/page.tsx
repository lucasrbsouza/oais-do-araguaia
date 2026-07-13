import { Suspense } from "react";
import UserDetailClient from "./user-detail-client";

/**
 * No export estático (protótipo/GitHub Pages) as rotas dinâmicas precisam ser
 * pré-geradas: o modo demo usa os ids "u-admin", "u-dono" e "u1".."u30". No
 * deploy real (standalone), qualquer id continua funcionando.
 */
export function generateStaticParams(): Array<{ id: string }> {
  return [
    { id: "u-admin" },
    { id: "u-dono" },
    ...Array.from({ length: 30 }, (_, i) => ({ id: `u${i + 1}` })),
  ];
}

export default function UserProfilePage() {
  return (
    <Suspense fallback={null}>
      <UserDetailClient />
    </Suspense>
  );
}
