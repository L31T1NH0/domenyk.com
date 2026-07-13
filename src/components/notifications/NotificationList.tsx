"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

type Item = { _id: string; title: string; description: string; href: string; count: number; readAt?: string; updatedAt: string }

export function NotificationList() {
  const [items, setItems] = useState<Item[] | null>(null)
  useEffect(() => { fetch("/api/notifications", { cache: "no-store" }).then((r) => r.ok ? r.json() : { items: [] }).then((data) => setItems(data.items)) }, [])
  async function read(item: Item) { if (!item.readAt) { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item._id }) }); setItems((current) => current?.map((value) => value._id === item._id ? { ...value, readAt: new Date().toISOString() } : value) ?? []) } }
  async function readAll() { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); setItems((current) => current?.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })) ?? []) }
  return <div className="py-10 sm:py-16"><div className="flex items-center justify-between"><h1 className="text-3xl font-semibold tracking-tight">Notificações</h1><button onClick={readAll} className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400">Marcar todas como lidas</button></div>{items === null ? <p className="mt-8 text-sm text-zinc-500">Carregando…</p> : items.length === 0 ? <p className="mt-8 text-sm text-zinc-500">Nada novo por aqui.</p> : <ol className="mt-8 border-t border-zinc-300 dark:border-zinc-800">{items.map((item) => <li key={item._id} className="border-b border-zinc-300 dark:border-zinc-800"><Link href={item.href} onClick={() => void read(item)} className="flex gap-3 py-5"><span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-zinc-950 dark:bg-white"}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.title}{item.count > 1 ? ` (${item.count})` : ""}</span><span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">{item.description}</span></span><time className="shrink-0 text-xs text-zinc-500">{new Date(item.updatedAt).toLocaleDateString("pt-BR")}</time></Link></li>)}</ol>}</div>
}
