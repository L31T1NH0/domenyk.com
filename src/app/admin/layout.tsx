"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import {
  Squares2X2Icon,
  UsersIcon,
  PencilSquareIcon,
  ChartBarIcon,
  LightBulbIcon,
  ClipboardDocumentCheckIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: Squares2X2Icon },
  { href: "/admin/editor", label: "Novo post", icon: PencilSquareIcon },
  { href: "/admin/analytics", label: "Analytics", icon: ChartBarIcon },
  { href: "/admin/users", label: "Usuários", icon: UsersIcon },
  { href: "/admin/ideias", label: "Banco de Ideias", icon: LightBulbIcon },
  { href: "/admin/checklist", label: "Checklist", icon: ClipboardDocumentCheckIcon },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const SidebarContent = () => (
    <>
      <div className="px-5 py-5 border-b border-white/8">
        <Link
          href="/"
          className="inline-flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm font-semibold tracking-tight text-[#f1f1f1] transition-colors hover:bg-white/5"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs font-bold text-[#f1f1f1]">
            d
          </span>
          domenyk.com
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#A8A095]">
          Painel
        </p>
        <ul className="space-y-1 list-none p-0 m-0">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[#E00070]/10 text-[#f1f1f1] border border-[#E00070]/25"
                      : "border border-transparent text-[#A8A095] hover:bg-white/5 hover:text-[#f1f1f1]"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? "text-[#E00070]" : "text-[#A8A095] group-hover:text-[#f1f1f1]"
                    }`}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#E00070]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/8 mt-auto">
        <SignedIn>
          <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/5 px-4 py-3">
            <span className="text-xs text-[#A8A095]">Logado</span>
            <UserButton appearance={{ elements: { userButtonPopoverCard: "bg-zinc-900" } }} />
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton>
            <button className="w-full rounded-md bg-[#E00070] px-4 py-3 text-sm font-medium text-white hover:opacity-80 transition">
              Entrar
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#040404] text-[#f1f1f1] overflow-x-hidden">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[220px_1fr]">

        {/* Sidebar desktop */}
        <aside className="hidden md:flex md:flex-col border-r border-white/8 bg-[#040404]">
          <SidebarContent />
        </aside>

        <div className="flex flex-col">

          {/* Header mobile */}
          <header className="sticky top-0 z-10 border-b border-white/8 bg-[#040404]/80 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen((open) => !open)}
                  aria-expanded={mobileOpen}
                  aria-controls="admin-mobile-nav"
                  className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#f1f1f1] hover:bg-white/10 focus:outline-none"
                >
                  <span className="sr-only">{mobileOpen ? "Fechar menu" : "Abrir menu"}</span>
                  {mobileOpen
                    ? <XMarkIcon className="h-5 w-5" />
                    : <Bars3Icon className="h-5 w-5" />
                  }
                </button>
                <Link href="/" className="text-sm font-semibold text-[#f1f1f1]">
                  domenyk.com
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <SignedIn>
                  <UserButton appearance={{ elements: { userButtonPopoverCard: "bg-zinc-900" } }} />
                </SignedIn>
                <SignedOut>
                  <SignInButton>
                    <button className="rounded-md bg-[#E00070] px-4 py-2 text-xs font-medium text-white hover:opacity-80 transition">
                      Entrar
                    </button>
                  </SignInButton>
                </SignedOut>
              </div>
            </div>

            {/* Mobile nav dropdown */}
            {mobileOpen && (
              <div
                id="admin-mobile-nav"
                className="border-t border-white/8 bg-[#040404] px-4 py-4"
              >
                <ul className="space-y-1 list-none p-0 m-0">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                            isActive
                              ? "bg-[#E00070]/10 text-[#f1f1f1] border border-[#E00070]/25"
                              : "border border-transparent text-[#A8A095] hover:bg-white/5 hover:text-[#f1f1f1]"
                          }`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#E00070]" : "text-[#A8A095]"}`} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </header>

          <main className="p-6 md:p-8 w-full max-w-screen-2xl mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
