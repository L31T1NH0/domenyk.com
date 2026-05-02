export const dynamic = "force-dynamic"

import Link from "next/link"
import { AdminNav } from "./AdminNav"
import { ClerkButton } from "@/components/ClerkButton"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-[#050505] dark:text-neutral-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-white/80 px-4 py-5 backdrop-blur dark:border-neutral-900 dark:bg-neutral-950/60">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link href="/admin" className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Admin</span>
              <span className="block truncate text-sm font-medium text-neutral-950 dark:text-neutral-100">domenyk</span>
            </Link>
            <ClerkButton />
          </div>

          <AdminNav />

          <div className="mt-auto border-t border-neutral-200 pt-4 dark:border-neutral-900">
            <Link
              href="/"
              className="block rounded-md px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
            >
              Ver site
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-6 py-6 lg:px-8">
          <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
