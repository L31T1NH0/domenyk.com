"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChartBarSquareIcon, ChatBubbleLeftRightIcon, DocumentTextIcon, FolderIcon, NewspaperIcon, PencilSquareIcon, TagIcon, UsersIcon } from "@heroicons/react/24/outline"

const navItems = [
  { href: "/admin", label: "Visão geral", icon: ChartBarSquareIcon },
  { href: "/admin/posts", label: "Posts", icon: DocumentTextIcon },
  { href: "/admin/notes", label: "Notas", icon: PencilSquareIcon },
  { href: "/admin/temas", label: "Temas", icon: TagIcon },
  { href: "/admin/comments", label: "Comentários", icon: ChatBubbleLeftRightIcon },
  { href: "/admin/messages", label: "Mensagens", icon: NewspaperIcon },
  { href: "/admin/media", label: "Mídia", icon: FolderIcon },
  { href: "/admin/users", label: "Pessoas", icon: UsersIcon },
]

export function AdminNav() {
  const pathname = usePathname()
  return <nav className="admin-nav" aria-label="Administração">
    {navItems.map((item) => {
      const active = item.href === "/admin" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
      const Icon = item.icon
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="admin-nav-link">
        <Icon aria-hidden className="size-[18px]" />
        <span>{item.label}</span>
      </Link>
    })}
  </nav>
}
