"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import type { SerializedNote } from "@/lib/db/notes"
import type { NoteMetrics } from "@/lib/db/note-metrics"

type AdminNote = SerializedNote & { metrics: Omit<NoteMetrics, "updatedAt"> }

export function AdminNotesTable({ notes }: { notes: AdminNote[] }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => notes.filter((note) => `${note.title ?? ""} ${note.seoTitle ?? ""} ${note.content}`.toLowerCase().includes(query.trim().toLowerCase())), [notes, query])
  return <section className="admin-records">
    <div className="admin-records-toolbar">
      <div><strong>Todas as notas</strong><small>{filtered.length} de {notes.length} registros</small></div>
      <label className="admin-control-search"><MagnifyingGlassIcon aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar notas" /></label>
    </div>

    <div className="admin-note-cards">
      {filtered.map((note) => <Link href={`/admin/notes/${note._id}`} key={note._id} className="admin-note-card">
        <div><strong>{note.title || note.seoTitle || "Nota sem título"}</strong>{note.thread && <small>Thread · parte {note.thread.position}</small>}<p>{note.content}</p></div>
        <dl><div><dt>SEO</dt><dd><span className={`admin-record-status ${note.indexable ? "is-live" : "is-review"}`}>{note.indexable ? "Indexável" : "Não indexável"}</span></dd></div><div><dt>Views reais</dt><dd>{note.metrics.directViews}</dd></div><div><dt>Publicada</dt><dd>{format(new Date(note.publishedAt), "dd MMM yyyy", { locale: ptBR })}</dd></div></dl>
      </Link>)}
    </div>

    <div className="admin-record-table-wrap">
      <table className="admin-record-table admin-note-table">
        <thead><tr><th scope="col">Nota</th><th scope="col">SEO</th><th scope="col">Views reais</th><th scope="col">Publicada</th><th scope="col" aria-label="Ação" /></tr></thead>
        <tbody>{filtered.map((note) => <tr key={note._id}>
          <td><Link href={`/admin/notes/${note._id}`}><strong>{note.title || note.seoTitle || "Nota sem título"}</strong>{note.thread && <small>Thread · parte {note.thread.position}</small>}<small>{note.content}</small></Link></td>
          <td><span className={`admin-record-status ${note.indexable ? "is-live" : "is-review"}`}>{note.indexable ? "Indexável" : "Não indexável"}</span></td>
          <td className="admin-record-number">{note.metrics.directViews}</td>
          <td><time>{format(new Date(note.publishedAt), "dd MMM yyyy", { locale: ptBR })}</time></td>
          <td><Link href={`/admin/notes/${note._id}`} className="admin-record-open">Abrir</Link></td>
        </tr>)}</tbody>
      </table>
    </div>
    {filtered.length === 0 && <p className="admin-empty">Nenhuma nota encontrada.</p>}
  </section>
}
