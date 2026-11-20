export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { HomeIcon } from "@heroicons/react/24/outline"
import { AdminNav } from "./AdminNav"
import { AdminMenu } from "./AdminMenu"
import { isAdmin } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) notFound()

  return (
    <div className="admin-shell">
      <div className="admin-frame">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <AdminMenu />
          </div>

          <AdminNav />

          <div className="admin-sidebar-footer">
            <Link
              href="/"
              className="admin-nav-link"
            >
              <HomeIcon aria-hidden className="size-[18px]" />
              Voltar para o site
            </Link>
          </div>
        </aside>

        <header className="admin-mobile-header">
          <AdminMenu />
        </header>

        <div className="admin-content-wrap">
          <main className="admin-content">
            {process.env.NODE_ENV === "development" && process.env.ADMIN_LOCAL_PREVIEW === "true" && <p className="mb-5 border border-amber-600/40 px-4 py-3 text-xs text-amber-700 dark:text-amber-300" role="status">Ambiente de teste local. As alterações não são publicadas no domenyk.com.</p>}
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
