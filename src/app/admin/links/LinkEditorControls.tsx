"use client"

import { useEffect, useRef, useState } from "react"
import { XMarkIcon } from "@heroicons/react/24/outline"
import type { ContentKind, LinkContent } from "@/lib/link-page"

export async function linkEditorRequest<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.")
  return data as T
}

export function ContentPicker({ onSelect, onClose, allowLinks = false }: { onSelect: (content: LinkContent) => void; onClose: () => void; allowLinks?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<ContentKind | "all">("all")
  const [items, setItems] = useState<LinkContent[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(() => { dialog.current?.showModal(); searchRef.current?.focus() }, [])
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      fetch(`/api/admin/links/content?q=${encodeURIComponent(search)}`, { signal: controller.signal })
        .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data.items as LinkContent[] })
        .then(data => { setItems(data); setError("") })
        .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Não foi possível carregar os conteúdos.") })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 250)
    return () => { clearTimeout(timeout); controller.abort() }
  }, [search])
  const visible = items.filter(item => (allowLinks || item.kind !== "link") && (kind === "all" || item.kind === kind))
  return <dialog ref={dialog} onClose={onClose} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-auto rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-950 shadow-xl backdrop:bg-black/40 dark:border-white/15 dark:bg-neutral-950 dark:text-white">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Escolher conteúdo</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="Fechar seletor" className="grid size-11 place-items-center"><XMarkIcon className="size-5" /></button></div>
    <label className="admin-field"><span>Buscar título, trecho ou identificador</span><input ref={searchRef} type="search" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setLoading(true) }} placeholder="Buscar no conteúdo publicado…" /></label>
    <label className="admin-field mt-3"><span>Tipo</span><select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="all">Todos</option><option value="post">Textos</option><option value="note">Notas</option>{allowLinks && <option value="link">Links cadastrados</option>}</select></label>
    <p className="my-3 text-xs text-neutral-500">Até 50 resultados recentes. Use a busca para encontrar conteúdos antigos.</p>
    {error && <p role="alert" className="admin-form-error">{error}</p>}
    {loading ? <p role="status" className="py-8 text-sm text-neutral-500">Buscando…</p> : <ul className="divide-y divide-neutral-200 dark:divide-white/10">{visible.map(item => <li key={`${item.kind}:${item.id}`}><button type="button" onClick={() => { onSelect(item); dialog.current?.close() }} className="flex w-full items-center gap-3 rounded-lg py-3 text-left hover:bg-neutral-50 focus-visible:outline-2 dark:hover:bg-white/5">
      {item.cover && <img src={item.cover} alt="" className="size-14 shrink-0 rounded-md object-cover" />}<span className="min-w-0"><span className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">{item.kind === "post" ? "Texto" : item.kind === "note" ? "Nota" : "Link"}</span><strong className="block break-words text-sm">{item.title}</strong><span className="mt-1 line-clamp-2 break-words text-xs text-neutral-500">{item.description}</span></span>
    </button></li>)}</ul>}
    {!loading && !visible.length && !error && <p className="py-8 text-sm text-neutral-500">Nenhum conteúdo encontrado.</p>}
  </dialog>
}

export function CoverField({ url, alt, onChange, onBusyChange, disabled = false }: { url: string; alt: string; onChange: (url: string, alt: string) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [library, setLibrary] = useState<{ url: string }[] | null>(null)
  const [mediaCursor, setMediaCursor] = useState<string | null>(null)
  function pending(value: boolean) { setBusy(value); onBusyChange?.(value) }
  async function upload(file: File) {
    pending(true); setError("")
    try {
      const response = await fetch("/api/admin/links/media", { method: "POST", headers: { "Content-Type": file.type }, body: file })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      onChange(data.url, alt)
    } catch (error) { setError(error instanceof Error ? error.message : "Falha no envio da capa.") }
    finally { pending(false) }
  }
  return <fieldset disabled={disabled || busy} className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-white/15">
    <legend className="px-1 text-sm font-medium">Capa</legend>
    {url && <img src={url} alt={alt} className="aspect-[2/1] max-h-40 w-full rounded-md object-cover" />}
    <div className="flex flex-wrap items-center gap-2">
      <label className="admin-button-secondary cursor-pointer">{busy ? "Enviando…" : "Enviar imagem"}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = "" }} /></label>
      <button type="button" className="admin-button-secondary" onClick={async () => {
        if (library) { setLibrary(null); return }
        pending(true); setError("")
        try { const data = await linkEditorRequest<{ items: { url: string }[]; cursor: string | null }>("/api/admin/links/media"); setLibrary(data.items); setMediaCursor(data.cursor) }
        catch (error) { setError(error instanceof Error ? error.message : "Falha na biblioteca.") }
        finally { pending(false) }
      }}>Biblioteca</button>
      {url && <button type="button" className="admin-button-secondary" onClick={() => onChange("", "")}>Remover capa</button>}
    </div>
    {library && <div className="grid max-h-48 grid-cols-3 gap-2 overflow-auto sm:grid-cols-4">{library.map((item, index) => <button type="button" key={item.url} aria-label={`Usar imagem ${index + 1}`} onClick={() => { onChange(item.url, alt); setLibrary(null) }} className="rounded-md focus-visible:outline-2"><img src={item.url} alt="" className="aspect-square w-full rounded-md object-cover" loading="lazy" /></button>)}{!library.length && <p className="col-span-full text-xs text-neutral-500">A biblioteca está vazia.</p>}</div>}
    {library && mediaCursor && <button type="button" className="admin-button-secondary" onClick={async () => {
      pending(true); setError("")
      try { const data = await linkEditorRequest<{ items: { url: string }[]; cursor: string | null }>(`/api/admin/links/media?cursor=${encodeURIComponent(mediaCursor)}`); setLibrary(current => [...current || [], ...data.items]); setMediaCursor(data.cursor) }
      catch (error) { setError(error instanceof Error ? error.message : "Falha ao carregar imagens.") }
      finally { pending(false) }
    }}>Carregar mais imagens</button>}
    <label className="admin-field"><span>Endereço da imagem</span><input value={url} maxLength={2048} onChange={event => onChange(event.target.value, alt)} placeholder="https://… ou /images/…" /></label>
    <label className="admin-field"><span>Descrição da imagem</span><input value={alt} maxLength={180} onChange={event => onChange(url, event.target.value)} /></label>
    {error && <p role="alert" className="admin-form-error">{error}</p>}
  </fieldset>
}
