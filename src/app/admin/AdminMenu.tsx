"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useClerk, useUser } from "@clerk/nextjs"
import {
  ArrowLeftIcon,
  ArrowRightStartOnRectangleIcon,
  BellAlertIcon,
  ChartBarSquareIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  FolderIcon,
  HomeIcon,
  MoonIcon,
  NewspaperIcon,
  PencilSquareIcon,
  SunIcon,
  TagIcon,
  UserCircleIcon,
  UsersIcon,
} from "@heroicons/react/24/outline"
import { useThemeSwitcher } from "@/components/ThemeSwitcher"
import { revokePrivatePushForCurrentDevice } from "@/lib/client-push"

const navItems = [
  { href: "/admin", label: "Visão geral", icon: ChartBarSquareIcon },
  { href: "/admin/posts", label: "Posts", icon: DocumentTextIcon },
  { href: "/admin/notes", label: "Notas", icon: PencilSquareIcon },
  { href: "/admin/temas", label: "Temas", icon: TagIcon },
  { href: "/admin/comments", label: "Comentários", icon: ChatBubbleLeftRightIcon },
  { href: "/admin/messages", label: "Mensagens", icon: NewspaperIcon },
  { href: "/admin/notificacoes", label: "Notificações", icon: BellAlertIcon },
  { href: "/admin/media", label: "Mídia", icon: FolderIcon },
  { href: "/admin/users", label: "Pessoas", icon: UsersIcon },
]

export function AdminMenu() {
  const pathname = usePathname()
  const clerk = useClerk()
  const { isLoaded, isSignedIn, user } = useUser()
  const { darkMode, toggleTheme } = useThemeSwitcher()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function closeMenu(restoreFocus = false) {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function menuItems() {
    return Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [])
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu()
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      closeMenu(true)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
    const items = menuItems()
    if (items.length === 0) return
    event.preventDefault()
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length
    items[nextIndex]?.focus()
  }

  async function signOut() {
    closeMenu()
    if (isSignedIn) await revokePrivatePushForCurrentDevice().catch(() => undefined)
    await clerk.signOut({ redirectUrl: "/" })
  }

  return (
    <div ref={rootRef} className="admin-menu-root">
      <button
        ref={triggerRef}
        type="button"
        className="admin-menu-trigger"
        aria-label="Abrir menu da administração"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => open ? closeMenu() : setOpen(true)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
          event.preventDefault()
          setOpen(true)
          requestAnimationFrame(() => menuItems()[0]?.focus())
        }}
      >
        {isLoaded && isSignedIn && user?.imageUrl
          ? <img src={user.imageUrl} alt="" />
          : <UserCircleIcon aria-hidden />}
      </button>

      {open && (
        <div id={menuId} role="menu" aria-label="Menu da administração" className="admin-menu-panel" onKeyDown={handleMenuKeyDown}>
          {isLoaded && isSignedIn && user && (
            <div className="admin-menu-account">
              <img src={user.imageUrl} alt="" />
              <span><strong>{user.fullName ?? user.username ?? "Conta"}</strong><small>{user.primaryEmailAddress?.emailAddress ?? "Administrador"}</small></span>
            </div>
          )}

          <div className="admin-menu-section admin-menu-navigation">
            {navItems.map((item) => {
              const active = item.href === "/admin" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} role="menuitem" aria-current={active ? "page" : undefined} onClick={() => closeMenu()} className="admin-menu-item">
                  <Icon aria-hidden />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>

          <div className="admin-menu-section">
            <Link href="/" role="menuitem" onClick={() => closeMenu()} className="admin-menu-item">
              <HomeIcon aria-hidden />
              <span>Voltar para o site</span>
              <ArrowLeftIcon aria-hidden className="admin-menu-trailing" />
            </Link>
            <button type="button" role="menuitem" onClick={toggleTheme} className="admin-menu-item">
              {darkMode ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
              <span>Tema</span>
              <small>{darkMode ? "Escuro" : "Claro"}</small>
            </button>
          </div>

          {isLoaded && isSignedIn && (
            <div className="admin-menu-section">
              <button type="button" role="menuitem" onClick={() => { closeMenu(); clerk.openUserProfile() }} className="admin-menu-item">
                <Cog6ToothIcon aria-hidden />
                <span>Gerenciar conta</span>
              </button>
              <button type="button" role="menuitem" onClick={() => void signOut()} className="admin-menu-item admin-menu-signout">
                <ArrowRightStartOnRectangleIcon aria-hidden />
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
