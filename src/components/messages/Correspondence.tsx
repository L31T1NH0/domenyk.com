"use client"

import { FormEvent, useEffect, useState } from "react"
import { useClerk, useUser } from "@clerk/nextjs"

type Entry = { _id: string; authorName: string; body: string; createdAt: string; readAt?: string; isOwn: boolean }
type Thread = { _id: string; subject: string; category: string; status: string; archivedAt?: string; entries?: Entry[]; updatedAt: string; lastMessage?: { body: string; createdAt: string } | null }

const STATUS_LABELS: Record<string, string> = {
  open: "aguardando resposta", answered: "respondido", accepted: "sugestão aceita",
  declined: "sugestão negada", closed: "encerrado",
}

export function Correspondence() {
  const { isLoaded, isSignedIn } = useUser()
  const clerk = useClerk()
  const [threads, setThreads] = useState<Thread[]>([])
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [category, setCategory] = useState("idea")
  const [reply, setReply] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [archived, setArchived] = useState(false)

  async function openThread(id: string) {
    setSelected(id)
    if (threads.find((thread) => thread._id === id)?.entries) return
    const response = await fetch(`/api/messages/${id}`, { cache: "no-store" })
    if (!response.ok) return
    const detail = await response.json()
    setThreads((current) => current.map((thread) => thread._id === id ? detail : thread))
  }

  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false
    fetch(`/api/messages${archived ? "?archived=1" : ""}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((data) => { if (!cancelled) { setThreads(data.items); setCursor(data.nextCursor); setHasMore(data.hasMore) } })
    return () => { cancelled = true }
  }, [isSignedIn, archived])

  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("")
    const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, body, category }) })
    const data = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) return setError(data.error ?? "Não foi possível enviar.")
    setThreads((current) => [data, ...current]); setSelected(data._id); setSubject(""); setBody("")
  }

  async function loadMore() {
    if (!cursor) return
    const params = new URLSearchParams({ cursor, ...(archived ? { archived: "1" } : {}) })
    const response = await fetch(`/api/messages?${params}`, { cache: "no-store" })
    if (!response.ok) return
    const data = await response.json()
    setThreads((current) => [...current, ...data.items]); setCursor(data.nextCursor); setHasMore(data.hasMore)
  }

  async function answer(id: string) {
    const text = reply[id]?.trim(); if (!text) return
    setBusy(true); setError("")
    const response = await fetch(`/api/messages/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) })
    const data = await response.json().catch(() => ({})); setBusy(false)
    if (!response.ok) return setError(data.error ?? "Não foi possível responder.")
    setThreads((current) => current.map((thread) => thread._id === id ? data : thread)); setReply((current) => ({ ...current, [id]: "" }))
  }

  if (!isLoaded) return <p className="py-16 text-sm text-zinc-500">Carregando…</p>
  if (!isSignedIn) return (
    <div className="py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Fale comigo</h1>
      <p className="mt-4 max-w-lg text-zinc-600 dark:text-zinc-400">Um lugar para enviar uma ideia, sugestão ou melhoria diretamente, sem precisar encaixá-la em um post.</p>
      <button onClick={() => clerk.openSignIn()} className="mt-6 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-950">Entrar para escrever</button>
    </div>
  )

  return (
    <div className="py-10 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Fale comigo</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Envie uma ideia, crítica ou melhoria. Não é um chat: cada mensagem vira um assunto que podemos continuar quando fizer sentido.</p>
      <form onSubmit={send} className="mt-8 border-y border-zinc-300 py-6 dark:border-zinc-800">
        <label className="block text-sm font-medium" htmlFor="subject">Assunto</label>
        <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required className="mt-2 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700" placeholder="O que você quer compartilhar?" />
        <label className="mt-5 block text-sm font-medium" htmlFor="message">Mensagem</label>
        <textarea id="message" value={body} onChange={(e) => setBody(e.target.value)} minLength={10} maxLength={5000} required rows={6} className="mt-2 w-full resize-y rounded-md border border-zinc-300 bg-transparent px-3 py-2 leading-6 outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700" placeholder="Conte a ideia com o contexto que achar importante." />
        <label className="mt-5 block text-sm font-medium" htmlFor="category">Categoria</label>
        <select id="category" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 dark:bg-[#040404]"><option value="idea">Ideia</option><option value="correction">Correção</option><option value="improvement">Melhoria</option><option value="other">Outro</option></select>
        <div className="mt-3 flex items-center justify-between gap-4"><span className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</span><button disabled={busy} className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950">{busy ? "Enviando…" : "Enviar mensagem"}</button></div>
      </form>
      <section className="mt-10" aria-labelledby="history-title">
        <div className="flex items-center justify-between"><h2 id="history-title" className="text-lg font-semibold">Seus assuntos</h2><button type="button" onClick={() => { setArchived((value) => !value); setSelected(null) }} className="text-sm text-zinc-500 underline-offset-4 hover:underline">{archived ? "Ver atuais" : "Ver arquivados"}</button></div>
        {threads.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Quando você escrever, a conversa ficará guardada aqui.</p> : threads.map((thread) => (
          <article id={thread._id} key={thread._id} className="border-b border-zinc-300 py-7 dark:border-zinc-800">
            <button type="button" onClick={() => void openThread(thread._id)} className="flex w-full items-baseline justify-between gap-4 text-left"><span className="min-w-0"><span className="block font-semibold">{thread.subject}</span>{thread.lastMessage && <span className="mt-1 block truncate text-sm text-zinc-500">{thread.lastMessage.body}</span>}</span><span className="shrink-0 text-right text-xs text-zinc-500">{STATUS_LABELS[thread.status] ?? thread.status}<time className="mt-1 block">{new Date(thread.updatedAt).toLocaleDateString("pt-BR")}</time></span></button>
            {selected === thread._id && <><ol className="mt-5 space-y-5">{thread.entries?.map((entry) => <li key={entry._id}><div className="flex items-baseline justify-between gap-3 text-xs text-zinc-500"><strong className="font-medium text-zinc-700 dark:text-zinc-300">{entry.authorName}</strong><span><time>{new Date(entry.createdAt).toLocaleDateString("pt-BR")}</time>{entry.isOwn && <span className="ml-2">· {entry.readAt ? "lido" : "não lido"}</span>}</span></div><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{entry.body}</p></li>) ?? <li className="text-sm text-zinc-500">Carregando…</li>}</ol>
            {thread.status === "closed" ? <p className="mt-5 text-sm text-zinc-500">Este assunto foi encerrado.</p> : <div className="mt-5 flex gap-2"><textarea aria-label={`Responder a ${thread.subject}`} value={reply[thread._id] ?? ""} onChange={(e) => setReply((current) => ({ ...current, [thread._id]: e.target.value }))} rows={2} maxLength={5000} className="min-w-0 flex-1 resize-y rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700" placeholder="Acrescentar algo…" /><button type="button" disabled={busy || !reply[thread._id]?.trim() || !thread.entries} onClick={() => answer(thread._id)} className="self-end rounded-md border border-zinc-400 px-3 py-2 text-sm disabled:opacity-40 dark:border-zinc-600">Responder</button></div>}</>}
          </article>
        ))}
        {hasMore && <button type="button" onClick={() => void loadMore()} className="mt-6 rounded-md border border-zinc-400 px-3 py-2 text-sm dark:border-zinc-600">Carregar assuntos anteriores</button>}
      </section>
    </div>
  )
}
