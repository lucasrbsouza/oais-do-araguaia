"use client";

import {
  CalendarDays,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PartyPopper,
  BedDouble,
  ScrollText,
  ShoppingCart,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IS_DEMO, logout, tryRefreshSession } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/session";
import { UserAvatar } from "@/components/ui/avatar";
import { ChangePasswordDialog } from "@/components/ui/change-password-dialog";
import { LOGO_SRC } from "@/lib/assets";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/eventos", label: "Eventos", icon: PartyPopper },
  { href: "/compras-evento", label: "Compras", icon: ShoppingCart },
  { href: "/reservas", label: "Reservas", icon: BedDouble },
  { href: "/chales", label: "Chalés", icon: Home },
  { href: "/usuarios", label: "Usuários", icon: Users },
  { href: "/auditoria", label: "Auditoria", icon: ScrollText, adminOnly: true },
];

/** Atalhos da barra inferior; o resto do menu fica na gaveta. */
const BOTTOM_NAV_HREFS = ["/dashboard", "/calendario", "/eventos", "/reservas", "/chales"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, user, clearSession } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [firstLoginPrompt, setFirstLoginPrompt] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Prompt user to change password on first access.
  useEffect(() => {
    if (status === "authenticated" && user?.mustChangePassword) {
      setFirstLoginPrompt(true);
    }
  }, [status, user?.mustChangePassword]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user.role === "ADMIN",
  );
  const bottomItems = items.filter((item) => BOTTOM_NAV_HREFS.includes(item.href));

  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);

  const signOut = (): void => void logout().then(() => router.replace("/login"));

  // Navegar fecha a gaveta; no menu lateral do desktop ela já está fechada.
  const closeMenu = (): void => setMenuOpen(false);

  /** Mesma lista no menu lateral do desktop e na gaveta do celular. */
  const navLinks = (
    <nav className="flex-1 space-y-1 p-3" aria-label="Menu principal">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={closeMenu}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-body hover:bg-surface-soft",
            isActive(href) && "bg-surface-strong text-ink",
          )}
        >
          <Icon className="size-4.5 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );

  const userFooter = (
    <div className="border-t border-hairline p-4">
      <Link
        href="/perfil"
        onClick={closeMenu}
        className="flex items-center gap-3 rounded-sm px-1 py-1.5 -mx-1 hover:bg-surface-soft transition-colors"
      >
        <UserAvatar
          userId={user.id}
          name={user.name}
          hasAvatar={user.hasAvatar}
          className="size-9"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="truncate text-xs text-muted">
            {user.role === "ADMIN" ? "Administrador" : "Proprietário"}
          </p>
        </div>
      </Link>
      <button
        onClick={signOut}
        className="mt-3 flex items-center gap-2 text-sm text-muted hover:text-error cursor-pointer"
      >
        <LogOut className="size-4" aria-hidden /> Sair
      </button>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-canvas md:flex">
        <div className="border-b border-hairline px-5 py-5 flex items-center gap-3">
          <img
            src={LOGO_SRC}
            alt="Logo Oasís do Araguaia"
            className="size-10 object-contain"
          />
          <div className="min-w-0">
            <span className="text-base font-bold text-primary block leading-tight">Oasís do Araguaia</span>
            <p className="text-[10px] text-muted">Condomínio de chalés</p>
          </div>
        </div>
        {navLinks}
        {userFooter}
      </aside>

      {/* Gaveta do celular: leva o menu inteiro, inclusive Compras e Auditoria,
          que não cabem na barra inferior. */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
            role="presentation"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-canvas shadow-float"
          >
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <img
                  src={LOGO_SRC}
                  alt=""
                  className="size-9 shrink-0 object-contain"
                />
                <span className="truncate font-bold text-primary">Oasís do Araguaia</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-soft cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>
            {navLinks}
            {userFooter}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-hairline px-2 py-2 md:hidden">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            className="flex size-11 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-soft cursor-pointer"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={LOGO_SRC}
              alt="Logo Oasís do Araguaia"
              className="size-8 shrink-0 object-contain"
            />
            <span className="truncate font-bold text-primary">Oasís do Araguaia</span>
          </div>
          <div className="flex shrink-0 items-center">
            <Link
              href="/perfil"
              aria-label="Perfil"
              className="flex size-11 items-center justify-center rounded-sm text-muted hover:bg-surface-soft"
            >
              <User className="size-5" />
            </Link>
            <button
              onClick={signOut}
              aria-label="Sair"
              className="flex size-11 items-center justify-center rounded-sm text-muted hover:bg-surface-soft cursor-pointer"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </header>
        {IS_DEMO && (
          <div className="border-b border-warning/30 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-warning">
            Protótipo de demonstração — os dados são fictícios e ficam salvos apenas
            neste navegador.
          </div>
        )}
        <main className="flex-1 bg-surface-soft/50 p-4 md:p-6 lg:p-8">{children}</main>
        <nav
          className="sticky bottom-0 z-30 flex justify-around border-t border-hairline bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Menu rápido"
        >
          {bottomItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-medium text-muted",
                isActive(href) && "text-primary",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* First-login password change prompt */}
      <ChangePasswordDialog
        open={firstLoginPrompt}
        onClose={() => setFirstLoginPrompt(false)}
        firstLogin
      />
    </div>
  );
}
