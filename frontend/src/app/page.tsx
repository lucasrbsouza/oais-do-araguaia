"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Redirect no cliente: funciona também no export estático (GitHub Pages).
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
