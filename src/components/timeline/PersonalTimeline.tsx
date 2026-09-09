"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/outline"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import type { PersonalTimelinePage, PersonalUpdate, PersonalUpdateOrderDirection } from "@/lib/personal-timeline"
import { formatSiteDate } from "@/lib/datetime"

const Composer = dynamic(() => import("./PersonalUpdateComposer"), {
  loading: () => <p role="status" className="text-sm text-neutral-600 dark:text-neutral-400">Carregando editor…</p>,
})

async function fetchPage(signal: AbortSignal, cursor?: string): Promise<PersonalTimelinePage> {
  const response = await fetch(`/api/mural${cursor ? `?cursor=${cursor}` : ""}`, { signal, cache: "no-store" })
  if (!response.ok) throw new Error("Não foi possível carregar o mural.")
  return response.json()
}

export function PersonalTimeline({ isAdmin, compact = false }: { isAdmin: boolean; compact?: boolean }) {
  const [items, setItems] = useState<PersonalUpdate[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [ordering, setOrdering] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const [actionError, setActionError] = useState("")
  const requestRef = useRef<AbortController | null>(null)
  const moreRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async (nextCursor?: string) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError("")
    try {
      const data = await fetchPage(controller.signal, nextCursor)
      if (controller.signal.aborted) return
      setItems(previous => nextCursor
        ? [...previous, ...data.items.filter(item => !previous.some(existing => existing._id === item._id))]
        : data.items)
      setCursor(data.nextCursor)
    } catch {
      if (!controller.signal.aborted) setError("Não foi possível carregar o mural.")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    requestRef.current = controller
    void fetchPage(controller.signal).then(data => {
      if (controller.signal.aborted) return
      setItems(data.items)
      setCursor(data.nextCursor)
    }).catch(() => {
      if (!controller.signal.aborted) setError("Não foi possível carregar o mural.")
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => requestRef.current?.abort()
  }, [])

  useEffect(() => {
    const target = moreRef.current
    if (!compact || !cursor || loading || error || !target) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void load(cursor)
    }, { rootMargin: "120px" })
    observer.observe(target)
    return () => observer.disconnect()
  }, [compact, cursor, loading, error, load])

  function saved(item: PersonalUpdate) {
    setItems(previous => previous.some(existing => existing._id === item._id)
      ? previous.map(existing => existing._id === item._id ? item : existing)
      : [item, ...previous])
    setEditing(null)
    setActionError("")
    setStatus("Publicação salva.")
  }

  async function remove(id: string) {
    setActionError("")
    const response = await fetch(`/api/mural/${id}`, { method: "DELETE" })
    if (!response.ok) throw new Error("Não foi possível excluir a publicação.")
    setItems(previous => previous.filter(item => item._id !== id))
    setStatus("Publicação excluída.")
  }

  async function reorder(id: string, direction: PersonalUpdateOrderDirection) {
    if (ordering) return
    setOrdering(id)
    setStatus("")
    setActionError("")
    try {
      const response = await fetch(`/api/mural/${id}/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Não foi possível alterar a ordem.")
      const page = data as PersonalTimelinePage
      setItems(page.items)
      setCursor(page.nextCursor)
      setStatus("Ordem do mural atualizada.")
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Não foi possível alterar a ordem.")
    } finally {
      setOrdering(null)
    }
  }

  return (
    <div className={`personal-timeline w-full min-w-0 ${compact ? "personal-timeline-compact" : ""}`}>
      {!compact && isAdmin && !loading && <div id="publicar" className="mb-6"><Composer onSaved={saved} /></div>}
      <p className="sr-only" role="status">{status}</p>
      {actionError && <p role="alert" className="personal-timeline-order-error">{actionError}</p>}
      {!compact && loading && items.length === 0 && <p role="status" className="personal-timeline-muted py-4">Carregando…</p>}
      {!compact && !loading && !error && items.length === 0 && <p className="personal-timeline-muted py-4">{isAdmin ? "Seu mural está pronto para a primeira publicação." : "Ainda não há publicações."}</p>}
      <div aria-busy={loading} className="personal-timeline-items w-full min-w-0">
        {items.map((item, index) => (
          <article key={item._id} id={`publicacao-${item._id}`} className="personal-timeline-item w-full min-w-0">
            {!compact && <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
              <span className="personal-timeline-date">
                <time dateTime={item.createdAt}>{formatSiteDate(item.createdAt, { day: "numeric", month: "short", year: "numeric" })}</time>
              </span>
              {!compact && isAdmin && <div className="flex items-center gap-1">
                <div className="flex items-center" role="group" aria-label="Ordenar publicação" aria-busy={ordering === item._id}>
                  <button type="button" className="personal-timeline-order-control" disabled={Boolean(ordering) || Boolean(editing) || index === 0} aria-label="Mover publicação para cima" title="Mover para cima" onClick={() => void reorder(item._id, "up")}>
                    <ArrowUpIcon aria-hidden className="size-4" />
                  </button>
                  <button type="button" className="personal-timeline-order-control" disabled={Boolean(ordering) || Boolean(editing) || (index === items.length - 1 && !cursor)} aria-label="Mover publicação para baixo" title="Mover para baixo" onClick={() => void reorder(item._id, "down")}>
                    <ArrowDownIcon aria-hidden className="size-4" />
                  </button>
                </div>
                <button type="button" disabled={Boolean(ordering)} className="personal-timeline-action" onClick={() => setEditing(item._id)}>Editar</button>
                <DeleteActionMenu disabled={Boolean(ordering) || Boolean(editing)} title="Excluir publicação do mural?" triggerAriaLabel="Excluir publicação do mural" onDelete={() => remove(item._id)} />
              </div>}
            </div>}
            {editing === item._id && !compact
              ? <Composer item={item} onSaved={saved} onCancel={() => setEditing(null)} />
              : <div className="personal-timeline-content w-full min-w-0" dangerouslySetInnerHTML={{ __html: item.contentHtml }} />}
          </article>
        ))}
      </div>
      {!compact && error && <div role="alert" className="py-3 text-sm"><p>{error}</p><button type="button" className="personal-timeline-action" onClick={() => void load(items.length ? cursor ?? undefined : undefined)}>Tentar novamente</button></div>}
      {!compact && cursor && !error && <button type="button" disabled={loading} className="personal-timeline-action mt-3" onClick={() => void load(cursor)}>{loading ? "Carregando…" : "Mais publicações"}</button>}
      {compact && cursor && <div ref={moreRef} aria-hidden="true" className="h-px" />}
    </div>
  )
}
