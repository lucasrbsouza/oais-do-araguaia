"use client";

import {
  CalendarDays,
  Home,
  LayoutDashboard,
  LogOut,
  PartyPopper,
  BedDouble,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { IS_DEMO, logout, tryRefreshSession } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/session";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/eventos", label: "Eventos", icon: PartyPopper },
  { href: "/reservas", label: "Reservas", icon: BedDouble },
  { href: "/chales", label: "Chalés", icon: Home },
  { href: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, user, clearSession } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "loading") return;
    void tryRefreshSession().then((ok) => {
      if (!ok) {
        clearSession();
      }
    });
  }, [status, clearSession]);

  useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "ADMIN");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-canvas md:flex">
        <div className="border-b border-hairline px-5 py-5">
          <span className="text-lg font-bold text-primary">Oaís do Araguaia</span>
          <p className="text-xs text-muted">Condomínio de chalés</p>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Menu principal">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-body hover:bg-surface-soft",
                pathname.startsWith(href) && "bg-surface-strong text-ink",
              )}
            >
              <Icon className="size-4.5" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-hairline p-4">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="truncate text-xs text-muted">
            {user.role === "ADMIN" ? "Administrador" : "Proprietário"}
          </p>
          <button
            onClick={() => void logout().then(() => router.replace("/login"))}
            className="mt-3 flex items-center gap-2 text-sm text-muted hover:text-error"
          >
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-hairline px-4 py-3 md:hidden">
          <span className="font-bold text-primary">Oaís do Araguaia</span>
          <button
            onClick={() => void logout().then(() => router.replace("/login"))}
            aria-label="Sair"
            className="text-muted"
          >
            <LogOut className="size-5" />
          </button>
        </header>
        {IS_DEMO && (
          <div className="border-b border-warning/30 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-warning">
            Protótipo de demonstração — os dados são fictícios e ficam salvos apenas
            neste navegador.
          </div>
        )}
        <main className="flex-1 bg-surface-soft/50 p-4 md:p-8">{children}</main>
        <nav
          className="flex justify-around border-t border-hairline bg-canvas py-2 md:hidden"
          aria-label="Menu móvel"
        >
          {items.slice(0, 5).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                "rounded-sm p-2 text-muted",
                pathname.startsWith(href) && "text-primary",
              )}
            >
              <Icon className="size-5" />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
