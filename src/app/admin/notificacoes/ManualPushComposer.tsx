"use client"

import { useMemo, useState } from "react"
import { BellAlertIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline"

export type PushContentOption = {
  id: string
  type: "post" | "note"
  title: string
  description: string
  href: string
}

export function ManualPushComposer({ content }: { content: PushContentOption[] }) {
  const [selectedValue, setSelectedValue] = useState(content[0] ? `${content[0].type}:${content[0].id}` : "")
  const selected = useMemo(() => content.find((item) => `${item.type}:${item.id}` === selectedValue), [content, selectedValue])
  const [title, setTitle] = useState(content[0] ? `Vale a leitura: ${content[0].title}` : "")
  const [message, setMessage] = useState(content[0]?.description ?? "")
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [result, setResult] = useState("")
  const [error, setError] = useState("")

  function select(value: string) {
    const item = content.find((candidate) => `${candidate.type}:${candidate.id}` === value)
    setSelectedValue(value)
    setTitle(item ? `Vale a leitura: ${item.title}` : "")
    setMessage(item?.description ?? "")
    setConfirming(false)
    setRequestId(null)
    setResult("")
    setError("")
  }

  function review() {
    if (!selected || !title.trim() || !message.trim()) return
    setRequestId(crypto.randomUUID())
    setConfirming(true)
    setResult("")
    setError("")
  }

  async function send() {
    if (!selected || !requestId) return
    setSending(true)
    setError("")
    try {
      const response = await fetch("/api/admin/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: selected.type,
          contentId: selected.id,
          title: title.trim(),
          message: message.trim(),
          requestId,
        }),
      })
      const data = await response.json().catch(() => null) as { sent?: number; failed?: number; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível enviar a notificação.")
      setResult(`Disparo concluído: ${data?.sent ?? 0} dispositivo(s) avisado(s)${data?.failed ? ` e ${data.failed} falha(s)` : ""}.`)
      setConfirming(false)
      setRequestId(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a notificação.")
    } finally {
      setSending(false)
    }
  }

  const posts = content.filter((item) => item.type === "post")
  const notes = content.filter((item) => item.type === "note")

  return (
    <section className="admin-list">
      <header className="admin-list-header"><div><strong>Disparo editorial</strong><small>Destaque um conteúdo já publicado</small></div></header>
      <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.75fr)] lg:p-5">
        <div className="space-y-4">
          <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
            Conteúdo
            <select value={selectedValue} onChange={(event) => select(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-800">
              {posts.length > 0 && <optgroup label="Posts">{posts.map((item) => <option key={`post:${item.id}`} value={`post:${item.id}`}>{item.title}</option>)}</optgroup>}
              {notes.length > 0 && <optgroup label="Notas">{notes.map((item) => <option key={`note:${item.id}`} value={`note:${item.id}`}>{item.title}</option>)}</optgroup>}
            </select>
          </label>
          <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
            Título da notificação
            <input value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); setConfirming(false) }} className="mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-xs font-normal text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-800" />
          </label>
          <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
            Mensagem
            <textarea value={message} maxLength={240} rows={4} onChange={(event) => { setMessage(event.target.value); setConfirming(false) }} className="mt-1.5 w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-xs font-normal leading-5 text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-800" />
            <span className="mt-1 block text-right text-[10px] font-normal text-neutral-500">{message.length}/240</span>
          </label>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.08em] text-neutral-500">Prévia</p>
          <div className="rounded-xl bg-neutral-950 p-3.5 text-white dark:bg-white dark:text-neutral-950">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 dark:bg-black/10"><BellAlertIcon className="size-4" aria-hidden /></span>
              <div className="min-w-0"><strong className="block text-xs leading-5">{title.trim() || "Título da notificação"}</strong><p className="mt-0.5 text-[11px] leading-4 text-neutral-300 dark:text-neutral-600">{message.trim() || "A mensagem aparecerá aqui."}</p><span className="mt-2 block truncate text-[10px] text-neutral-400 dark:text-neutral-500">domenyk.com{selected?.href}</span></div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-neutral-500">O disparo vai apenas para quem escolheu receber {selected?.type === "note" ? "notas" : "posts"}. Abrir a notificação leva diretamente ao conteúdo.</p>
        </div>

        <div className="lg:col-span-2">
          {confirming ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">Confirmar este disparo para os leitores inscritos?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirming(false)} disabled={sending} className="admin-button-secondary">Cancelar</button>
                <button type="button" onClick={() => void send()} disabled={sending} className="admin-button-primary inline-flex items-center justify-center gap-2"><PaperAirplaneIcon className="size-4" aria-hidden /> {sending ? "Enviando…" : "Confirmar envio"}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={review} disabled={!selected || !title.trim() || !message.trim()} className="admin-button-primary inline-flex items-center justify-center gap-2"><PaperAirplaneIcon className="size-4" aria-hidden /> Revisar disparo</button>
          )}
          {result && <p role="status" className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">{result}</p>}
          {error && <p role="alert" className="mt-3 text-xs text-red-700 dark:text-red-300">{error}</p>}
        </div>
      </div>
    </section>
  )
}
