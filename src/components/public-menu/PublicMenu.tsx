"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useClerk, useUser } from "@clerk/nextjs"
import {
  ArrowLeftIcon,
  ArrowRightEndOnRectangleIcon,
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  LanguageIcon,
  HomeIcon,
  InformationCircleIcon,
  EnvelopeIcon,
  MoonIcon,
  PencilSquareIcon,
  SunIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline"
import { POST_LOCALE_DETAILS } from "@/lib/post-locales"
import { useThemeSwitcher } from "@/components/ThemeSwitcher"
import { PushSubscriptionManager } from "@/components/notifications/PushSubscriptionManager"
import { usePublicMenu } from "./PublicMenuContext"

const ITEM_CLASS_NAME = "group flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-zinc-700 outline-none transition-colors hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/[0.07] dark:focus-visible:bg-white/[0.07]"

export function PublicMenu() {
  const { isLoaded, isSignedIn, user } = useUser()
  const clerk = useClerk()
  const { darkMode, toggleTheme } = useThemeSwitcher()
  const { currentLocale, options } = usePublicMenu()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [verifiedAdminUserId, setVerifiedAdminUserId] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [view, setView] = useState<"main" | "account" | "notifications">("main")
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const accountBackRef = useRef<HTMLButtonElement>(null)
  const notificationsBackRef = useRef<HTMLButtonElement>(null)
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null)
  const focusFirstOnOpenRef = useRef(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return
    let cancelled = false
    fetch("/api/account/admin", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { admin: false })
      .then((data) => { if (!cancelled) setVerifiedAdminUserId(data.admin === true ? user.id : null) })
    fetch("/api/messages/unread", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { unread: 0 })
      .then((data) => { if (!cancelled) setUnreadMessages(Math.max(0, Number(data.unread) || 0)) })
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn, user?.id])

  const admin = Boolean(isLoaded && isSignedIn && user?.id && verifiedAdminUserId === user.id)

  useEffect(() => {
    if (!admin) return
    let cancelled = false

    function refreshUnreadNotifications() {
      fetch("/api/notifications", { cache: "no-store" })
        .then((response) => response.ok ? response.json() : { unread: 0 })
        .then((data) => {
          if (!cancelled) setUnreadNotifications(Math.max(0, Number(data.unread) || 0))
        })
    }

    refreshUnreadNotifications()
    const interval = window.setInterval(refreshUnreadNotifications, 45_000)
    const onFocus = () => refreshUnreadNotifications()
    window.addEventListener("focus", onFocus)
    window.addEventListener("notifications:changed", refreshUnreadNotifications)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("notifications:changed", refreshUnreadNotifications)
    }
  }, [admin, open])

  function menuItems() {
    return Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>("[role^='menuitem']:not([aria-disabled='true'])") ?? []
    )
  }

  function openMenu(focusFirst = false) {
    focusFirstOnOpenRef.current = focusFirst
    setOpen(true)
  }

  function closeMenu({ restoreFocus = false } = {}) {
    setOpen(false)
    setView("main")
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function openAccountView() {
    setView("account")
    requestAnimationFrame(() => accountBackRef.current?.focus())
  }

  function closeAccountView() {
    setView("main")
    requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLButtonElement>("[data-account-settings]")?.focus()
    })
  }

  function openNotificationsView() {
    setView("notifications")
    requestAnimationFrame(() => notificationsBackRef.current?.focus())
  }

  function closeNotificationsView() {
    setView("main")
    requestAnimationFrame(() => notificationsTriggerRef.current?.focus())
  }

  useEffect(() => {
    if (!open) return
    if (focusFirstOnOpenRef.current) {
      focusFirstOnOpenRef.current = false
      requestAnimationFrame(() => menuItems()[0]?.focus())
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu()
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      if (view === "account") {
        closeAccountView()
      } else if (view === "notifications") {
        closeNotificationsView()
      } else {
        closeMenu({ restoreFocus: true })
      }
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, view])

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (view === "notifications") return
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

  function manageAccount() {
    closeMenu()
    clerk.openUserProfile()
  }

  function signIn() {
    closeMenu()
    clerk.openSignIn()
  }

  async function signOut() {
    closeMenu()
    if (isSignedIn && "serviceWorker" in navigator) {
      let subscription: PushSubscription | null = null
      try {
        const registration = await navigator.serviceWorker.getRegistration("/")
        subscription = await registration?.pushManager.getSubscription() ?? null
        if (subscription) {
          const response = await fetch("/api/push/subscriptions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
            keepalive: true,
          })
          if (!response.ok) throw new Error("Não foi possível revogar os alertas privados.")
        }
      } catch {
        await subscription?.unsubscribe().catch(() => false)
      }
    }
    setVerifiedAdminUserId(null)
    await clerk.signOut({ redirectUrl: "/" })
  }

  const isPostPage = /(?:^|\/)posts\/[^/]+$/.test(pathname)
  const hasUnreadItems = unreadMessages > 0 || unreadNotifications > 0

  return (
    <div ref={rootRef} className="relative z-40">
      <button
        ref={triggerRef}
        type="button"
        aria-label={hasUnreadItems ? "Abrir menu, há mensagens ou notificações não lidas" : "Abrir menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => open ? closeMenu() : openMenu()}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
          event.preventDefault()
          openMenu(true)
        }}
        className="grid size-9 place-items-center overflow-hidden rounded-full text-zinc-600 outline-none transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f4f4] dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-[#040404]"
      >
        {isLoaded && isSignedIn && user?.imageUrl ? (
          <img src={user.imageUrl} alt="" className="size-8 rounded-full object-cover !grayscale-0" />
        ) : (
          <Bars3Icon className="size-5" aria-hidden />
        )}
      </button>
      {isLoaded && isSignedIn && hasUnreadItems && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 size-2.5 rounded-full bg-red-600 ring-2 ring-[#f4f4f4] dark:bg-red-500 dark:ring-[#040404]"
        />
      )}

      {open && (
        <div
          id={menuId}
          role={view === "notifications" ? "dialog" : "menu"}
          aria-label={view === "account" ? "Menu da conta" : view === "notifications" ? "Configurar notificações" : "Menu do site"}
          onKeyDown={handleMenuKeyDown}
          className={`${view === "notifications" ? "w-[min(19rem,calc(100vw-2rem))]" : "w-[min(17rem,calc(100vw-2rem))]"} public-menu-panel absolute right-0 top-11 origin-top-right rounded-[10px] border border-zinc-200 bg-white p-1.5 text-zinc-950 shadow-[0_6px_8px_rgba(0,0,0,0.12)] sm:left-0 sm:right-auto sm:origin-top-left dark:border-white/10 dark:bg-[#151515] dark:text-zinc-100 dark:shadow-[0_6px_8px_rgba(0,0,0,0.38)]`}
        >
          {view === "notifications" ? (
            <div className="p-1">
              <button
                ref={notificationsBackRef}
                type="button"
                onClick={closeNotificationsView}
                className={ITEM_CLASS_NAME}
              >
                <ArrowLeftIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                <span className="font-medium">Notificações</span>
              </button>
              <div className="mt-1 border-t border-zinc-200 px-1.5 pb-1 pt-3 dark:border-white/10">
                <p className="mb-3 text-[11px] leading-[1.55] text-zinc-500 dark:text-zinc-400">Escolha o que deseja receber neste dispositivo.</p>
                <PushSubscriptionManager compact showAdminEvents={Boolean(isLoaded && isSignedIn && admin)} />
              </div>
            </div>
          ) : view === "account" && isLoaded && isSignedIn && user ? (
            <>
              <button
                ref={accountBackRef}
                type="button"
                role="menuitem"
                onClick={closeAccountView}
                className={ITEM_CLASS_NAME}
              >
                <ArrowLeftIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                <span className="font-medium">Conta</span>
              </button>

              <div className="mt-1 border-t border-zinc-200 pt-1.5 dark:border-white/10">
                <button type="button" role="menuitem" onClick={manageAccount} className={ITEM_CLASS_NAME}>
                  <UserCircleIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                  <span className="flex-1">Gerenciar conta</span>
                  <ChevronRightIcon className="size-3.5 text-zinc-400" aria-hidden />
                </button>
                <button type="button" role="menuitem" onClick={() => void signOut()} className={ITEM_CLASS_NAME}>
                  <ArrowRightStartOnRectangleIcon className="size-[18px] text-zinc-500 transition-colors group-hover:text-red-600 group-focus-visible:text-red-600 dark:text-zinc-400 dark:group-hover:text-red-400 dark:group-focus-visible:text-red-400" aria-hidden />
                  Sair
                </button>
              </div>
            </>
          ) : (
            <>
              {isLoaded && isSignedIn && user ? (
                <div className="flex min-w-0 items-center gap-2.5 px-2.5 py-2.5">
                  <img src={user.imageUrl} alt="" className="size-8 shrink-0 rounded-full object-cover !grayscale-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-zinc-950 dark:text-white">
                      {user.fullName ?? user.username ?? "Conta"}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {user.primaryEmailAddress?.emailAddress ?? "Conectado"}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    data-account-settings
                    onClick={openAccountView}
                    aria-label="Abrir opções da conta"
                    title="Conta"
                    className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-500 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-white dark:focus-visible:bg-white/[0.07] dark:focus-visible:ring-zinc-300"
                  >
                    <Cog6ToothIcon className="size-[17px]" aria-hidden />
                  </button>
                </div>
              ) : null}

              {!isLoaded ? (
                <div role="menuitem" aria-disabled="true" className={`${ITEM_CLASS_NAME} cursor-wait border-t border-zinc-200 text-zinc-400 dark:border-white/10`}>
                  <UserCircleIcon className="size-[18px]" aria-hidden />
                  Carregando conta…
                </div>
              ) : !isSignedIn ? (
                <div className="border-b border-zinc-200 pb-1.5 dark:border-white/10">
                  <button type="button" role="menuitem" onClick={signIn} className={ITEM_CLASS_NAME}>
                    <ArrowRightEndOnRectangleIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                    Entrar
                  </button>
                </div>
              ) : null}

              <div className={isLoaded && isSignedIn ? "border-t border-zinc-200 pt-1.5 dark:border-white/10" : "pt-1"}>
                {isPostPage && (
                  <div>
                    <Link href="/" role="menuitem" onClick={() => closeMenu()} className={ITEM_CLASS_NAME}>
                      <HomeIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                      Início
                    </Link>
                    <Link href="/notes" role="menuitem" onClick={() => closeMenu()} className={ITEM_CLASS_NAME}>
                      <PencilSquareIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                      Notas
                    </Link>
                  </div>
                )}
                <div className={isPostPage ? "mt-1 border-t border-zinc-200 pt-1.5 dark:border-white/10" : ""}>
                  <button type="button" role="menuitem" onClick={toggleTheme} className={ITEM_CLASS_NAME}>
                    {darkMode
                      ? <SunIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                      : <MoonIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />}
                    <span className="flex-1">Tema</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{darkMode ? "Escuro" : "Claro"}</span>
                  </button>
                </div>
                <div className="mt-1 border-t border-zinc-200 pt-1.5 dark:border-white/10">
                  <Link href="/fale-comigo" role="menuitem" onClick={() => closeMenu()} className={ITEM_CLASS_NAME}>
                    <EnvelopeIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                    <span className="flex-1">Fale comigo</span>
                    {unreadMessages > 0 && <span aria-label={`${unreadMessages} mensagens não lidas`} className="min-w-5 rounded-full bg-zinc-950 px-1.5 py-0.5 text-center text-[10px] font-medium text-white dark:bg-white dark:text-zinc-950">{unreadMessages > 99 ? "99+" : unreadMessages}</span>}
                  </Link>
                  {isLoaded && isSignedIn && admin ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-0.5">
                      <Link href="/notificacoes" role="menuitem" onClick={() => closeMenu()} className={ITEM_CLASS_NAME}>
                        <BellIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                        <span className="flex-1">Notificações</span>
                        {unreadNotifications > 0 && <span aria-label={`${unreadNotifications} notificações não lidas`} className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
                      </Link>
                      <button
                        ref={notificationsTriggerRef}
                        type="button"
                        role="menuitem"
                        onClick={openNotificationsView}
                        aria-label="Configurar notificações neste dispositivo"
                        title="Configurar notificações"
                        className="grid size-8 place-items-center rounded-md text-zinc-500 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-white dark:focus-visible:bg-white/[0.07] dark:focus-visible:ring-zinc-300"
                      >
                        <Cog6ToothIcon className="size-[17px]" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <button ref={notificationsTriggerRef} type="button" role="menuitem" onClick={openNotificationsView} className={ITEM_CLASS_NAME}>
                      <BellIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                      <span className="flex-1">Receber atualizações</span>
                      <ChevronRightIcon className="size-3.5 text-zinc-400" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="mt-1 border-t border-zinc-200 pt-1.5 dark:border-white/10">
                  <Link href="/sobre" role="menuitem" onClick={() => closeMenu()} className={ITEM_CLASS_NAME}>
                    <InformationCircleIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                    Sobre
                  </Link>
                </div>
              </div>

              {options.length > 1 && (
                <div className="mt-1 border-t border-zinc-200 px-1 pt-1.5 dark:border-white/10">
                  <div className="flex items-center gap-2 px-1.5 pb-1 pt-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    <LanguageIcon className="size-3.5" aria-hidden />
                    Idioma
                  </div>
                  {options.map(({ locale, href }) => {
                    const details = POST_LOCALE_DETAILS[locale]
                    const current = locale === currentLocale
                    const content = (
                      <>
                        <span lang={details.htmlLang} className="flex-1">{details.nativeLabel}</span>
                        <span className="text-[10px] font-medium text-zinc-400">{details.shortLabel}</span>
                        {current && <CheckIcon className="size-3.5 text-zinc-700 dark:text-zinc-200" aria-hidden />}
                      </>
                    )

                    return current || !href ? (
                      <button
                        key={locale}
                        type="button"
                        role="menuitemradio"
                        aria-checked={current}
                        onClick={() => current ? undefined : closeMenu()}
                        className={ITEM_CLASS_NAME}
                      >
                        {content}
                      </button>
                    ) : (
                      <a
                        key={locale}
                        href={href}
                        hrefLang={details.htmlLang}
                        role="menuitemradio"
                        aria-checked="false"
                        onClick={() => closeMenu()}
                        className={ITEM_CLASS_NAME}
                      >
                        {content}
                      </a>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
