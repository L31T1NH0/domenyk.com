"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/notes", label: "Notes" },
  { href: "/admin/comments", label: "Comentários" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/users", label: "Usuários" },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1" aria-label="Admin">
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
              "rounded-md px-3 py-2 text-sm transition-colors",
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
