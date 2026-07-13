"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import type { SerializedNote } from "@/lib/db/notes"

export function AdminNotesTable({ notes }: { notes: SerializedNote[] }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => notes.filter((note) => `${note.title ?? ""} ${note.seoTitle ?? ""} ${note.content}`.toLowerCase().includes(query.trim().toLowerCase())), [notes, query])
  return <section className="admin-list">
    <div className="admin-list-toolbar"><div><strong>Todas as notas</strong><small>{filtered.length} de {notes.length}</small></div><label className="admin-search"><MagnifyingGlassIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar notas" /></label></div>
    <header className="admin-list-header admin-note-row"><span>Nota</span><span>SEO</span><span>Publicada</span><span aria-hidden /></header>
    {filtered.map((note) => <Link href={`/admin/notes/${note._id}`} key={note._id} className="admin-list-row admin-note-row">
      <span className="admin-list-primary"><strong>{note.title || note.seoTitle || "Nota sem título"}</strong><small>{note.content}</small></span>
      <span><span className={`admin-status ${note.indexable ? "is-positive" : "is-warning"}`}>{note.indexable ? "Indexável" : "Não indexável"}</span></span>
      <time>{format(new Date(note.publishedAt), "dd MMM yyyy", { locale: ptBR })}</time>
      <span className="admin-list-action">Abrir</span>
    </Link>)}
    {filtered.length === 0 && <p className="admin-empty">Nenhuma nota encontrada.</p>}
  </section>
}
