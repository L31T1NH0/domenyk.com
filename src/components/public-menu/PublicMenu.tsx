"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent, type SVGProps } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useClerk, useUser } from "@clerk/nextjs"
import {
  ArrowLeftIcon,
  ArrowRightEndOnRectangleIcon,
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  LanguageIcon,
  HomeIcon,
  InformationCircleIcon,
  EnvelopeIcon,
  MoonIcon,
  MinusIcon,
  PencilSquareIcon,
  PlusIcon,
  SunIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline"
import { POST_LOCALE_DETAILS } from "@/lib/post-locales"
import { useThemeSwitcher } from "@/components/ThemeSwitcher"
import { PushSubscriptionManager } from "@/components/notifications/PushSubscriptionManager"
import { revokePrivatePushForCurrentDevice } from "@/lib/client-push"
import { POST_READING_POSITION_SKIP_RESTORE_KEY } from "@/lib/post-reading-position"
import {
  effectiveReadingMetrics,
  hasCustomReadingPreferences,
  READING_PREFERENCE_RANGES,
  type ReadingPreferenceKey,
} from "@/lib/reading-preferences"
import { useReadingPreferences } from "@/components/post/ReadingPreferencesContext"
import { usePublicMenu } from "./PublicMenuContext"

const ITEM_CLASS_NAME = "group flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-zinc-700 outline-none transition-colors hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/[0.07] dark:focus-visible:bg-white/[0.07]"
const READING_STEPPER_BUTTON_CLASS_NAME = "grid size-9 shrink-0 place-items-center text-zinc-600 outline-none transition-colors hover:bg-zinc-100 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:focus-visible:ring-zinc-300 dark:disabled:text-zinc-600"

type ReadingStepperProps = {
  label: string
  value: string
  preferenceKey: ReadingPreferenceKey
  currentValue: number
  onAdjust: (key: ReadingPreferenceKey, direction: -1 | 1) => void
  onReset: (key: ReadingPreferenceKey) => void
  resetLabel: string
}

function ReadingStepper({
  label,
  value,
  preferenceKey,
  currentValue,
  onAdjust,
  onReset,
  resetLabel,
}: ReadingStepperProps) {
  const range = READING_PREFERENCE_RANGES[preferenceKey]
  const atMinimum = currentValue <= range.min
  const atMaximum = currentValue >= range.max

  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-2 py-1.5">
      <span className="min-w-0 flex-1 text-[12px] leading-[1.35] text-zinc-700 dark:text-zinc-200">
        {label}
      </span>
      <div
        role="group"
        data-reading-preference={preferenceKey}
        aria-label={`Ajustar ${label.toLocaleLowerCase("pt-BR")}`}
        className="flex shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#151515]"
      >
        <button
          type="button"
          data-reading-decrement
          disabled={atMinimum}
          onClick={() => onAdjust(preferenceKey, -1)}
          aria-label={`Diminuir ${label.toLocaleLowerCase("pt-BR")}`}
          className={READING_STEPPER_BUTTON_CLASS_NAME}
        >
          <MinusIcon className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          data-reading-reset
          onClick={() => onReset(preferenceKey)}
          aria-label={resetLabel}
          title={resetLabel}
          className="min-w-[5.25rem] border-x border-zinc-200 px-2 text-center text-[11px] font-medium tabular-nums text-zinc-700 outline-none transition-colors hover:bg-zinc-100 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.07] dark:focus-visible:ring-zinc-300"
        >
          <span aria-live="polite">{value}</span>
        </button>
        <button
          type="button"
          data-reading-increment
          disabled={atMaximum}
          onClick={() => onAdjust(preferenceKey, 1)}
          aria-label={`Aumentar ${label.toLocaleLowerCase("pt-BR")}`}
          className={READING_STEPPER_BUTTON_CLASS_NAME}
        >
          <PlusIcon className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function formatDecimal(value: number, precision: number) {
  return value.toFixed(precision).replace(".", ",")
}

function skipReadingPositionRestore(href: string) {
  try {
    const destination = new URL(href, window.location.href)
    window.sessionStorage.setItem(POST_READING_POSITION_SKIP_RESTORE_KEY, JSON.stringify({
      destination: `${destination.pathname}${destination.search}`,
      markedAt: Date.now(),
    }))
  } catch {
    // A failed marker must never prevent language navigation.
  }
}

function CrownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m3 7 3 10h12l3-10-5.5 4.5L12 5l-3.5 6.5L3 7Z" />
      <path d="M6 20h12" />
    </svg>
  )
}

export function PublicMenu() {
  const { isLoaded, isSignedIn, user } = useUser()
  const clerk = useClerk()
  const { darkMode, toggleTheme } = useThemeSwitcher()
  const {
    preferences: readingPreferences,
    metrics: readingBaseMetrics,
    adjustPreference,
    resetPreference,
    resetPreferences,
  } = useReadingPreferences()
  const { currentLocale, options } = usePublicMenu()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [verifiedAdminUserId, setVerifiedAdminUserId] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [view, setView] = useState<"main" | "account" | "language" | "notifications" | "reading">("main")
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const accountBackRef = useRef<HTMLButtonElement>(null)
  const languageBackRef = useRef<HTMLButtonElement>(null)
  const languageTriggerRef = useRef<HTMLButtonElement>(null)
  const notificationsBackRef = useRef<HTMLButtonElement>(null)
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null)
  const readingBackRef = useRef<HTMLButtonElement>(null)
  const readingTriggerRef = useRef<HTMLButtonElement>(null)
  const focusFirstOnOpenRef = useRef(false)
  const userCreatedAt = user?.createdAt?.getTime()

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return
    let cancelled = false
    const accountAge = userCreatedAt ? Date.now() - userCreatedAt : Number.POSITIVE_INFINITY
    if (accountAge >= 0 && accountAge <= 30 * 60 * 1000) {
      fetch("/api/account/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => undefined)
    }
    fetch("/api/account/admin", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { admin: false })
      .then((data) => { if (!cancelled) setVerifiedAdminUserId(data.admin === true ? user.id : null) })
    fetch("/api/messages/unread", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { unread: 0 })
      .then((data) => { if (!cancelled) setUnreadMessages(Math.max(0, Number(data.unread) || 0)) })
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn, user?.id, userCreatedAt])

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

  function openLanguageView() {
    setView("language")
    requestAnimationFrame(() => languageBackRef.current?.focus())
  }

  function closeLanguageView() {
    setView("main")
    requestAnimationFrame(() => languageTriggerRef.current?.focus())
  }

  function openNotificationsView() {
    setView("notifications")
    requestAnimationFrame(() => notificationsBackRef.current?.focus())
  }

  function closeNotificationsView() {
    setView("main")
    requestAnimationFrame(() => notificationsTriggerRef.current?.focus())
  }

  function openReadingView() {
    setView("reading")
    requestAnimationFrame(() => readingBackRef.current?.focus())
  }

  function closeReadingView() {
    setView("main")
    requestAnimationFrame(() => readingTriggerRef.current?.focus())
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
      } else if (view === "language") {
        closeLanguageView()
      } else if (view === "notifications") {
        closeNotificationsView()
      } else if (view === "reading") {
        closeReadingView()
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
    if (view === "notifications" || view === "reading") return
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
    if (isSignedIn) await revokePrivatePushForCurrentDevice().catch(() => undefined)
    setVerifiedAdminUserId(null)
    await clerk.signOut({ redirectUrl: "/" })
  }

  const isPostPage = /(?:^|\/)posts\/[^/]+$/.test(pathname)
  const isNotePage = pathname === "/notes" || /^\/notes\/[^/]+$/.test(pathname)
  const isHome = pathname === "/"
  const hasReadingControls = isHome || isPostPage || isNotePage
  const hasUnreadItems = unreadMessages > 0 || unreadNotifications > 0
  const currentLanguageOption = options.find(({ locale }) => locale === currentLocale)
  const currentLanguageDetails = currentLanguageOption
    ? POST_LOCALE_DETAILS[currentLanguageOption.locale]
    : null
  const orderedLanguageOptions = currentLanguageOption
    ? [currentLanguageOption, ...options.filter(({ locale }) => locale !== currentLocale)]
    : options
  const readingMetrics = effectiveReadingMetrics(readingPreferences, readingBaseMetrics)
  const hasCustomReading = hasCustomReadingPreferences(readingPreferences)
  const readingValues: Record<ReadingPreferenceKey, string> = {
    fontSize: readingPreferences.fontSize === null
      ? "Automática"
      : `${formatDecimal(readingMetrics.fontSize, 0)} px`,
    lineHeight: `${formatDecimal(readingMetrics.lineHeight, 3)}×`,
    letterSpacing: `${formatDecimal(readingMetrics.letterSpacing, 3)} em`,
    blockSpacing: `${formatDecimal(readingMetrics.blockSpacing, 3)} rem`,
  }

  return (
    <div
      ref={rootRef}
      className={`relative z-40 ${isHome ? "home-tablet-landscape-menu min-[84rem]:translate-x-[calc(32.5vw-12.2125rem)] min-[96rem]:translate-x-[calc(32.5vw-13.2125rem)] min-[96.5rem]:translate-x-[calc(35.0375rem-17.5vw)]" : ""}`}
    >
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
          role={view === "notifications" || view === "reading" ? "dialog" : "menu"}
          aria-label={view === "account" ? "Menu da conta" : view === "language" ? "Menu de idiomas" : view === "notifications" ? "Configurar notificações" : view === "reading" ? "Configurar leitura" : "Menu do site"}
          onKeyDown={handleMenuKeyDown}
          className={`${view === "notifications" || view === "reading" ? "w-[min(19rem,calc(100vw-2rem))]" : "w-[min(17rem,calc(100vw-2rem))]"} public-menu-panel absolute right-0 top-11 max-h-[calc(100dvh-4rem)] origin-top-right overflow-x-hidden overflow-y-auto rounded-[10px] border border-zinc-200 bg-white p-1.5 text-zinc-950 shadow-[0_6px_8px_rgba(0,0,0,0.12)] sm:left-0 sm:right-auto sm:origin-top-left ${isHome ? "home-tablet-landscape-menu-panel min-[84rem]:!left-auto min-[84rem]:!right-0 min-[84rem]:origin-top-right" : ""} dark:border-white/10 dark:bg-[#151515] dark:text-zinc-100 dark:shadow-[0_6px_8px_rgba(0,0,0,0.38)]`}
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
          ) : view === "reading" ? (
            <div>
              <button
                ref={readingBackRef}
                type="button"
                onClick={closeReadingView}
                className={ITEM_CLASS_NAME}
              >
                <ArrowLeftIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                <span className="font-medium">Leitura</span>
              </button>

              <div className="mt-1 divide-y divide-zinc-200 border-y border-zinc-200 py-1 dark:divide-white/10 dark:border-white/10">
                <ReadingStepper
                  label="Tamanho"
                  value={readingValues.fontSize}
                  preferenceKey="fontSize"
                  currentValue={readingMetrics.fontSize}
                  onAdjust={adjustPreference}
                  onReset={resetPreference}
                  resetLabel="Restaurar tamanho automático"
                />
                <ReadingStepper
                  label="Entrelinha"
                  value={readingValues.lineHeight}
                  preferenceKey="lineHeight"
                  currentValue={readingMetrics.lineHeight}
                  onAdjust={adjustPreference}
                  onReset={resetPreference}
                  resetLabel="Restaurar entrelinha padrão"
                />
                <ReadingStepper
                  label="Espaço entre letras"
                  value={readingValues.letterSpacing}
                  preferenceKey="letterSpacing"
                  currentValue={readingMetrics.letterSpacing}
                  onAdjust={adjustPreference}
                  onReset={resetPreference}
                  resetLabel="Restaurar espaço entre letras"
                />
                <ReadingStepper
                  label="Espaço entre blocos"
                  value={readingValues.blockSpacing}
                  preferenceKey="blockSpacing"
                  currentValue={readingMetrics.blockSpacing}
                  onAdjust={adjustPreference}
                  onReset={resetPreference}
                  resetLabel="Restaurar espaço entre blocos"
                />
              </div>

              <button
                type="button"
                disabled={!hasCustomReading}
                onClick={resetPreferences}
                className="mt-1 min-h-9 w-full rounded-md px-2.5 py-2 text-[12px] font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent dark:text-zinc-200 dark:hover:bg-white/[0.07] dark:focus-visible:ring-zinc-300 dark:disabled:text-zinc-600"
              >
                Restaurar tudo
              </button>
            </div>
          ) : view === "language" ? (
            <>
              <button
                ref={languageBackRef}
                type="button"
                role="menuitem"
                onClick={closeLanguageView}
                className={ITEM_CLASS_NAME}
              >
                <ArrowLeftIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                <span className="font-medium">Idioma</span>
              </button>

              <div className="mt-1 border-t border-zinc-200 pt-1.5 dark:border-white/10">
                {orderedLanguageOptions.map(({ locale, href }) => {
                  const details = POST_LOCALE_DETAILS[locale]
                  const current = locale === currentLocale
                  const content = (
                    <>
                      {current
                        ? <CheckIcon className="size-3.5 shrink-0 text-zinc-700 dark:text-zinc-200" aria-hidden />
                        : <span className="size-3.5 shrink-0" aria-hidden />}
                      <span lang={details.htmlLang} className="flex-1">{details.nativeLabel}</span>
                      <span className="text-[10px] font-medium text-zinc-400">{details.shortLabel}</span>
                    </>
                  )

                  if (current || !href) {
                    return (
                      <button
                        key={locale}
                        type="button"
                        role="menuitemradio"
                        aria-checked={current}
                        aria-disabled={!current && !href}
                        disabled={!current && !href}
                        className={`${ITEM_CLASS_NAME} ${!current && !href ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        {content}
                      </button>
                    )
                  }

                  return (
                    <a
                      key={locale}
                      href={href}
                      hrefLang={details.htmlLang}
                      role="menuitemradio"
                      aria-checked="false"
                      onClick={(event) => {
                        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                          skipReadingPositionRestore(href)
                        }
                        closeMenu()
                      }}
                      className={ITEM_CLASS_NAME}
                    >
                      {content}
                    </a>
                  )
                })}
              </div>
            </>
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
                  {admin && (
                    <Link href="/admin" role="menuitem" onClick={() => closeMenu()} className={ITEM_CLASS_NAME}>
                      <CrownIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                      Admin
                    </Link>
                  )}
                  {hasReadingControls && (
                    <button
                      ref={readingTriggerRef}
                      type="button"
                      role="menuitem"
                      data-reading-settings
                      onClick={openReadingView}
                      className={ITEM_CLASS_NAME}
                    >
                      <BookOpenIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                      <span className="flex-1">Leitura</span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {hasCustomReading ? "Personalizada" : "Automática"}
                      </span>
                      <ChevronRightIcon className="size-3.5 text-zinc-400" aria-hidden />
                    </button>
                  )}
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
                <div className="mt-1 border-t border-zinc-200 pt-1.5 dark:border-white/10">
                  <button
                    ref={languageTriggerRef}
                    type="button"
                    role="menuitem"
                    onClick={openLanguageView}
                    className={ITEM_CLASS_NAME}
                  >
                    <LanguageIcon className="size-[18px] text-zinc-500 dark:text-zinc-400" aria-hidden />
                    <span className="flex-1">Idioma</span>
                    {currentLanguageDetails && (
                      <span lang={currentLanguageDetails.htmlLang} className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {currentLanguageDetails.nativeLabel}
                      </span>
                    )}
                    <ChevronRightIcon className="size-3.5 text-zinc-400" aria-hidden />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
