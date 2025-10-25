import Link from "next/link";
import { ReactNode } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="hidden md:flex md:flex-col border-r border-zinc-800 bg-zinc-900/40">
          <div className="p-5 border-b border-zinc-800">
            <Link href="/admin" className="inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 text-zinc-900 font-bold">A</span>
              <span className="text-lg font-semibold tracking-tight">Admin</span>
            </Link>
          </div>
          <nav className="flex-1 p-3">
            <ul className="space-y-1">
              <li>
                <Link
                  href="/admin"
                  className="block rounded-md px-3 py-2 text-sm hover:bg-zinc-800/60"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/users"
                  className="block rounded-md px-3 py-2 text-sm hover:bg-zinc-800/60"
                >
                  Usuários
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/editor"
                  className="block rounded-md px-3 py-2 text-sm hover:bg-zinc-800/60"
                >
                  Novo post
                </Link>
              </li>
            </ul>
          </nav>
          <div className="p-4 border-t border-zinc-800">
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
          <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
            <div className="flex items-center justify-between gap-4 px-6 py-4 md:px-8">
              <div className="md:hidden">
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
          </header>
          <main className="p-6 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
