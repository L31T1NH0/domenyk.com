import Link from "next/link"
import { notFound } from "next/navigation"
import { getNote, serializeNote } from "@/lib/db/notes"
import { AdminNoteEditor } from "../AdminNoteEditor"
import { getNoteMetrics } from "@/lib/db/note-metrics"

export default async function AdminNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [note, metrics] = await Promise.all([getNote(id), getNoteMetrics(id)])
  if (!note) notFound()
  const title = note.title || note.seoTitle || "Nota sem título"
  return <><header className="admin-resource-header"><div><p><Link href="/admin/notes">Notas</Link> / {title}</p><h1>{title}</h1></div><Link className="admin-button-secondary" href={`/notes/${id}`} target="_blank">Ver no site</Link></header><AdminNoteEditor note={serializeNote(note)} metrics={{ directViews: metrics.directViews, homeImpressions: metrics.homeImpressions, notesImpressions: metrics.notesImpressions }} /></>
}
