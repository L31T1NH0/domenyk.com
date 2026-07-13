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
    <div className="admin-shell">
      <div className="admin-frame">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <Link href="/admin" className="min-w-0">
              <span className="admin-brand-mark">D</span>
              <span><strong>Domenyk Admin</strong><small>Painel editorial</small></span>
            </Link>
            <ClerkButton />
          </div>

          <AdminNav />

          <div className="admin-sidebar-footer">
            <Link
              href="/"
              className="admin-nav-link"
            >
              Ver site
            </Link>
          </div>
        </aside>

        <div className="admin-content-wrap">
          <main className="admin-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
