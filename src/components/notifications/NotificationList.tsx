"use client"

import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowUpRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import { formatSiteDate } from "@/lib/datetime"

type Item = {
  _id: string
  title: string
  description: string
  href: string
  actorImageUrl?: string
  count: number
  kind: "account" | "comment" | "message" | "reply" | "view"
  occurrences?: Array<{
    occurredAt: string
    source?: string
    device?: string
    browser?: string
    os?: string
    location?: string
    campaign?: string
    landingPage?: string
    language?: string
    visitorType?: string
    trafficType?: string
    reading?: {
      completedAt: string
      activeSeconds: number
      progress: number
    }
    actions?: Array<{
      type: "copied_link" | "commented" | "sent_message"
      occurredAt: string
    }>
  }>
  readAt?: string
  createdAt: string
  updatedAt: string
}

const occurrenceDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Fortaleza",
})

const occurrenceTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Fortaleza",
})

function occurrences(item: Item) {
  if (item.occurrences?.length) return item.occurrences
  if (item.count > 1 && item.createdAt !== item.updatedAt) {
    return [{ occurredAt: item.createdAt }, { occurredAt: item.updatedAt }]
  }
  return [{ occurredAt: item.updatedAt }]
}

const ACTION_LABELS = {
  copied_link: "Copiou o link",
  commented: "Comentou",
  sent_message: "Enviou uma mensagem",
} as const

function readingDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s ativos`
  return `${Math.max(1, Math.round(seconds / 60))} min ativos`
}

function notifyCountChanged() {
  window.dispatchEvent(new Event("notifications:changed"))
}

function NotificationDropdown({ item, anchor, onClose }: { item: Item; anchor: HTMLButtonElement; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const occurrenceItems = occurrences(item).toReversed()
  const hasCompleteHistory = occurrenceItems.length === item.count
  const [position, setPosition] = useState({ left: 8, top: 8, width: 320, maxHeight: 480 })

  useLayoutEffect(() => {
    function updatePosition() {
      const rect = anchor.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) return onClose()

      const viewportGap = 8
      const width = Math.min(480, Math.max(280, Math.min(rect.width, window.innerWidth - viewportGap * 2)))
      const left = Math.max(viewportGap, Math.min(rect.left, window.innerWidth - width - viewportGap))
      const panelHeight = Math.min(panelRef.current?.scrollHeight ?? 420, window.innerHeight * 0.7)
      const belowSpace = window.innerHeight - rect.bottom - viewportGap * 2
      const openAbove = belowSpace < Math.min(panelHeight, 300) && rect.top > belowSpace
      const top = openAbove
        ? Math.max(viewportGap, rect.top - panelHeight - 6)
        : rect.bottom + 6
      const maxHeight = openAbove
        ? Math.max(160, rect.top - viewportGap * 2)
        : Math.max(160, window.innerHeight - top - viewportGap)

      setPosition({ left, top, width, maxHeight })
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!panelRef.current?.contains(target) && !anchor.contains(target)) onClose()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      onClose()
      anchor.focus()
    }

    updatePosition()
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={panelRef}
      id={`notification-occurrences-${item._id}`}
      role="dialog"
      aria-label={`Detalhes da notificação: ${item.title}`}
      className="fixed z-50 overflow-y-auto rounded-xl border border-zinc-200 bg-[#f4f4f4] shadow-[0_4px_8px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-[#111] dark:shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
      style={position}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200 bg-[#f4f4f4] px-4 py-3 dark:border-zinc-800 dark:bg-[#111]">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {hasCompleteHistory ? `${item.count} ocorrências` : `${occurrenceItems.length} horários registrados`}
        </span>
        <Link
          href={item.href}
          onClick={onClose}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:text-zinc-400 dark:hover:text-white dark:focus-visible:outline-white"
        >
          Abrir conteúdo
          <ArrowUpRightIcon className="size-3.5" aria-hidden />
        </Link>
      </div>
      <ol className="px-4 py-1">
        {occurrenceItems.map((occurrence, index) => {
          const date = new Date(occurrence.occurredAt)
          const viewDetails = [
            ["Leitura", occurrence.reading ? `Concluída · ${readingDuration(occurrence.reading.activeSeconds)}` : "Não confirmada"],
            ["Origem", occurrence.source],
            ["Dispositivo", occurrence.device],
            ["Navegador", occurrence.browser],
            ["Sistema", occurrence.os],
            ["Localização", occurrence.location],
            ["Campanha", occurrence.campaign],
            ["Página de entrada", occurrence.landingPage],
            ["Idioma", occurrence.language],
            ["Visitante", occurrence.visitorType],
            ["Tráfego", occurrence.trafficType],
          ].filter((detail): detail is [string, string] => Boolean(detail[1]))
          const actionCounts = new Map<string, number>()
          occurrence.actions?.forEach((action) => {
            const label = ACTION_LABELS[action.type]
            actionCounts.set(label, (actionCounts.get(label) ?? 0) + 1)
          })
          const actionSummary = [...actionCounts].map(([label, count]) => count > 1 ? `${label} ${count}×` : label)
          return (
            <li key={`${occurrence.occurredAt}-${index}`} className="flex gap-3 border-b border-zinc-200 py-3 last:border-0 dark:border-zinc-800">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {hasCompleteHistory ? `Ocorrência ${item.count - index}` : index === 0 ? "Mais recente" : "Primeira ocorrência"}
                  </span>
                  <time dateTime={occurrence.occurredAt} className="shrink-0 text-xs font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {occurrenceDateFormatter.format(date)} · {occurrenceTimeFormatter.format(date)}
                  </time>
                </span>
                {item.kind === "view" && (
                  viewDetails.length ? (
                    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                      {viewDetails.map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <dt className="text-[10px] leading-4 text-zinc-500">{label}</dt>
                          <dd className="truncate text-[11px] font-medium leading-4 text-zinc-700 dark:text-zinc-300" title={value}>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <span className="mt-1.5 block text-[11px] text-zinc-500">Detalhes de acesso indisponíveis para esta ocorrência antiga.</span>
                  )
                )}
                {actionSummary.length > 0 && (
                  <span className="mt-2 block text-[11px] leading-4 text-zinc-500">
                    Ações posteriores: <strong className="font-medium text-zinc-700 dark:text-zinc-300">{actionSummary.join(" · ")}</strong>
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </div>,
    document.body
  )
}

export function NotificationList() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedAnchor, setExpandedAnchor] = useState<HTMLButtonElement | null>(null)
  const expandedItem = items?.find((item) => item._id === expandedId) ?? null

  const closeDropdown = useCallback(() => {
    setExpandedId(null)
    setExpandedAnchor(null)
  }, [])

  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((data) => setItems(data.items))
  }, [])

  async function read(item: Item) {
    if (item.readAt) return
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item._id }),
    })
    if (!response.ok) return
    setItems((current) => current?.map((value) => value._id === item._id
      ? { ...value, readAt: new Date().toISOString() }
      : value) ?? [])
    notifyCountChanged()
  }

  async function readAll() {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
    if (!response.ok) return
    setItems((current) => current?.map((item) => ({
      ...item,
      readAt: item.readAt ?? new Date().toISOString(),
    })) ?? [])
    notifyCountChanged()
  }

  async function remove(item: Item) {
    setError("")
    const response = await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item._id }),
    })
    if (!response.ok) {
      const message = "Não foi possível excluir a notificação. Tente novamente."
      setError(message)
      throw new Error(message)
    }
    setItems((current) => current?.filter((value) => value._id !== item._id) ?? [])
    if (expandedId === item._id) closeDropdown()
    notifyCountChanged()
  }

  function toggle(item: Item, anchor: HTMLButtonElement) {
    if (expandedId === item._id) closeDropdown()
    else {
      setExpandedId(item._id)
      setExpandedAnchor(anchor)
    }
    void read(item)
  }

  return (
    <div id="notifications-content-boundary" className="py-10 sm:py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Notificações</h1>
        <button
          type="button"
          onClick={() => void readAll()}
          disabled={!items?.some((item) => !item.readAt)}
          className="text-sm text-zinc-600 underline-offset-4 hover:underline disabled:cursor-default disabled:opacity-40 dark:text-zinc-400"
        >
          Marcar todas como lidas
        </button>
      </div>

      {error && <p role="alert" className="mt-5 text-sm text-red-700 dark:text-red-400">{error}</p>}

      {items === null ? (
        <p className="mt-8 text-sm text-zinc-500">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Nenhuma notificação.</p>
      ) : (
        <ol className="mt-8 border-t border-zinc-300 dark:border-zinc-800">
          {items.map((item) => {
            const expanded = expandedId === item._id
            const expandable = item.count > 1 || item.kind === "view"
            const content = (
              <>
                {item.actorImageUrl ? (
                  <span className="relative mt-0.5 size-8 shrink-0" aria-hidden>
                    <img src={item.actorImageUrl} alt="" className="size-8 rounded-full object-cover !grayscale-0" />
                    {!item.readAt && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red-600 ring-2 ring-[#f4f4f4] dark:ring-[#040404]" />}
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-red-600"}`}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span>{item.title}</span>
                    {item.count > 1 && (
                      <span className="inline-flex h-5 items-center rounded-full bg-zinc-200 px-2 text-[11px] font-semibold tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {item.count}×
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">{item.description}</span>
                </span>
                <time dateTime={item.updatedAt} className="hidden shrink-0 text-xs text-zinc-500 sm:block">
                  {formatSiteDate(item.updatedAt, { dateStyle: "short" })}
                </time>
              </>
            )

            return (
              <li key={item._id} className="border-b border-zinc-300 dark:border-zinc-800">
                <div className="flex items-center">
                  {expandable ? (
                    <button
                      type="button"
                      onClick={(event) => toggle(item, event.currentTarget)}
                      aria-haspopup="dialog"
                      aria-expanded={expanded}
                      aria-controls={`notification-occurrences-${item._id}`}
                      className="group flex min-w-0 flex-1 gap-3 py-5 pr-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:focus-visible:outline-white"
                    >
                      {content}
                      <ChevronDownIcon
                        aria-hidden
                        className={`mt-0.5 size-4 shrink-0 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : "group-hover:translate-y-0.5"}`}
                      />
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => void read(item)}
                      className="flex min-w-0 flex-1 gap-3 py-5 pr-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:focus-visible:outline-white"
                    >
                      {content}
                    </Link>
                  )}
                  <DeleteActionMenu
                    title="Excluir esta notificação?"
                    description="Ela será removida da sua central de notificações."
                    onDelete={() => remove(item)}
                    triggerAriaLabel={`Opções da notificação: ${item.title}`}
                    triggerClassName="grid size-10 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:outline-white"
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {expandedItem && expandedAnchor && typeof document !== "undefined" && (
        <NotificationDropdown item={expandedItem} anchor={expandedAnchor} onClose={closeDropdown} />
      )}
    </div>
  )
}
