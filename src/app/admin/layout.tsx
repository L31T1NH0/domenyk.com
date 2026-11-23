export const dynamic = "force-dynamic"

import { isAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers"
import "@astryxdesign/core/reset.css"
import "@astryxdesign/core/astryx.css"
import "@astryxdesign/core/tailwind-theme.css"
import { AdminShell } from "./_components/AdminShell"

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) notFound()

  const dark = (await cookies()).get("theme")?.value !== "light"
  return <AdminShell initialDark={dark} localPreview={process.env.NODE_ENV === "development" && process.env.ADMIN_LOCAL_PREVIEW === "true"}>{children}</AdminShell>
}
