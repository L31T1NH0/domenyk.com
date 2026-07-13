"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"

type Item = {
  _id: string
  title: string
  description: string
  href: string
  count: number
  readAt?: string
  updatedAt: string
}

function notifyCountChanged() {
  window.dispatchEvent(new Event("notifications:changed"))
}

export function NotificationList() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState("")

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
    notifyCountChanged()
  }

  return (
    <div className="py-10 sm:py-16">
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
            return (
              <li key={item._id} className="flex items-center border-b border-zinc-300 dark:border-zinc-800">
                <Link
                  href={item.href}
                  onClick={() => void read(item)}
                  className="flex min-w-0 flex-1 gap-3 py-5 pr-3"
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-red-600"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {item.title}{item.count > 1 ? ` (${item.count})` : ""}
                    </span>
                    <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">{item.description}</span>
                  </span>
                  <time dateTime={item.updatedAt} className="shrink-0 text-xs text-zinc-500">
                    {new Date(item.updatedAt).toLocaleDateString("pt-BR")}
                  </time>
                </Link>
                <DeleteActionMenu
                  title="Excluir esta notificação?"
                  description="Ela será removida da sua central de notificações."
                  onDelete={() => remove(item)}
                  triggerAriaLabel={`Opções da notificação: ${item.title}`}
                  triggerClassName="grid size-10 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:outline-white"
                />
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
