"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

function createQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        // Ninguém deve precisar dar F5: ao voltar para a aba ou recuperar a
        // conexão, a tela busca de novo o que ficou velho.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
    // Reserva, compra, pagamento e rateio se cruzam demais para depender de
    // cada tela lembrar o que invalidar. Toda mutation bem-sucedida marca o
    // cache inteiro como velho e as telas montadas recarregam sozinhas.
    mutationCache: new MutationCache({
      onSuccess: () => {
        void queryClient.invalidateQueries();
      },
    }),
  });
  return queryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
