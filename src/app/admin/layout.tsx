export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AdminNav } from "./AdminNav"
import { ClerkButton } from "@/components/ClerkButton"
import { isAdmin } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) notFound()

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-[#050505] dark:text-neutral-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="sticky top-0 z-30 flex shrink-0 flex-col border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-900 dark:bg-neutral-950/95 lg:h-screen lg:w-60 lg:border-b-0 lg:border-r lg:bg-white/80 lg:py-5 lg:dark:bg-neutral-950/60">
          <div className="mb-3 flex items-center justify-between gap-3 lg:mb-6">
            <Link href="/admin" className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Admin</span>
              <span className="block truncate text-sm font-medium text-neutral-950 dark:text-neutral-100">domenyk</span>
            </Link>
            <ClerkButton />
          </div>

          <AdminNav />

          <div className="mt-auto hidden border-t border-neutral-200 pt-4 dark:border-neutral-900 lg:block">
            <Link
              href="/"
              className="block rounded-md px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
            >
              Ver site
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
