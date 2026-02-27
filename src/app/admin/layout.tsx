"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Usuários" },
  { href: "/admin/editor", label: "Novo post" },
  { href: "/admin/analytics", label: "Analytics" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:flex md:flex-col border-r border-zinc-800 bg-zinc-900/40">
          <div className="px-5 py-4 border-b border-zinc-800">
            <Link href="/admin" className="text-base font-semibold tracking-tight">
              domenyk.com
            </Link>
          </div>
          <nav className="flex-1 px-3 py-5">
            <ul className="space-y-1 bg-transparent list-none p-0 m-0">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                        }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="p-4 border-t border-zinc-800 mt-auto">
            <SignedIn>
              <div className="flex items-center justify-between rounded-md bg-zinc-900 px-4 py-3">
                <span className="text-xs text-zinc-400">Logado</span>
                <UserButton appearance={{ elements: { userButtonPopoverCard: "bg-zinc-900" } }} />
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton>
                <button className="w-full rounded-md bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-200">
                  Entrar
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </aside>
        <div className="flex flex-col">
          <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60 md:hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-4 md:px-8">
              <div className="flex items-center gap-3 md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileOpen((open) => !open)}
                  aria-expanded={mobileOpen}
                  aria-controls="admin-mobile-nav"
                  className="inline-flex items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
                >
                  <span className="sr-only">{mobileOpen ? "Fechar menu" : "Abrir menu"}</span>
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    {mobileOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M6 14L14 6" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h14M3 10h14M3 14h14" />
                    )}
                  </svg>
                </button>
                <Link href="/admin" className="font-semibold">Admin</Link>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-4">
                <SignedIn>
                  <UserButton appearance={{ elements: { userButtonPopoverCard: "bg-zinc-900" } }} />
                </SignedIn>
                <SignedOut>
                  <SignInButton>
                    <button className="rounded-md bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-200">
                      Entrar
                    </button>
                  </SignInButton>
                </SignedOut>
              </div>
            </div>
            {mobileOpen && (
              <div
                id="admin-mobile-nav"
                className="border-t border-b border-zinc-800 bg-zinc-900/95 px-6 py-4 md:hidden"
              >
                <nav>
                  <ul className="space-y-1 list-none p-0 m-0">
                    {navItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive
                                ? "bg-zinc-800 text-zinc-100"
                                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                              }`}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            )}
          </header>
          <main className="p-6 md:p-8 w-full max-w-screen-2xl mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}

