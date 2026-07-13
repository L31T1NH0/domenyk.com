"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/notes", label: "Notes" },
  { href: "/admin/comments", label: "Comentários" },
  { href: "/admin/messages", label: "Mensagens" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/users", label: "Usuários" },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0" aria-label="Admin">
      {navItems.map((item) => {
        const active = item.href === "/admin"
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "shrink-0 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100",
            ].join(" ")}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
