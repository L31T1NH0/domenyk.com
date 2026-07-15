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
    <section className="admin-notification-composer">
      <header className="admin-workspace-header"><div><h2>Disparo editorial</h2><p>Destaque um conteúdo já publicado</p></div></header>
      <div className="admin-push-grid">
        <div className="admin-push-fields">
          <label className="admin-field">
            <span>Conteúdo</span>
            <select value={selectedValue} onChange={(event) => select(event.target.value)}>
              {posts.length > 0 && <optgroup label="Posts">{posts.map((item) => <option key={`post:${item.id}`} value={`post:${item.id}`}>{item.title}</option>)}</optgroup>}
              {notes.length > 0 && <optgroup label="Notas">{notes.map((item) => <option key={`note:${item.id}`} value={`note:${item.id}`}>{item.title}</option>)}</optgroup>}
            </select>
          </label>
          <label className="admin-field">
            <span>Título da notificação</span>
            <input value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); setConfirming(false) }} />
          </label>
          <label className="admin-field">
            <span>Mensagem</span>
            <textarea value={message} maxLength={240} rows={4} onChange={(event) => { setMessage(event.target.value); setConfirming(false) }} />
            <small>{message.length}/240</small>
          </label>
        </div>

        <div className="admin-push-preview">
          <p>Prévia no dispositivo</p>
          <div className="admin-push-notification">
            <div>
              <span><BellAlertIcon aria-hidden /></span>
              <div><strong>{title.trim() || "Título da notificação"}</strong><p>{message.trim() || "A mensagem aparecerá aqui."}</p><small>domenyk.com{selected?.href}</small></div>
            </div>
          </div>
          <p>O disparo vai apenas para quem escolheu receber {selected?.type === "note" ? "notas" : "posts"}. Abrir a notificação leva diretamente ao conteúdo.</p>
        </div>

        <div className="admin-push-submit">
          {confirming ? (
            <div className="admin-push-confirm">
              <p>Confirmar este disparo para os leitores inscritos?</p>
              <div>
                <button type="button" onClick={() => setConfirming(false)} disabled={sending} className="admin-button-secondary">Cancelar</button>
                <button type="button" onClick={() => void send()} disabled={sending} className="admin-button-primary"><PaperAirplaneIcon aria-hidden /> {sending ? "Enviando…" : "Confirmar envio"}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={review} disabled={!selected || !title.trim() || !message.trim()} className="admin-button-primary admin-push-review"><PaperAirplaneIcon aria-hidden /> Revisar disparo</button>
          )}
          {result && <p role="status" className="admin-form-success">{result}</p>}
          {error && <p role="alert" className="admin-form-error">{error}</p>}
        </div>
      </div>
    </section>
  )
}
