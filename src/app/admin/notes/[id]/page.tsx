import Link from "next/link"
import { notFound } from "next/navigation"
import { getNote, serializeNote } from "@/lib/db/notes"
import { AdminNoteEditor } from "../AdminNoteEditor"
import { getNoteMetrics } from "@/lib/db/note-metrics"
import { AdminCommandHeader } from "../../AdminCommandHeader"

export default async function AdminNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [note, metrics] = await Promise.all([getNote(id), getNoteMetrics(id)])
  if (!note) notFound()
  const title = note.title || note.seoTitle || "Nota sem título"
  return <><AdminCommandHeader title={title} back={{ href: "/admin/notes", label: "Notas" }} actions={<Link className="admin-button-secondary" href={`/notes/${id}`} target="_blank">Ver no site</Link>} /><AdminNoteEditor note={serializeNote(note)} metrics={{ directViews: metrics.directViews, homeImpressions: metrics.homeImpressions, notesImpressions: metrics.notesImpressions }} /></>
}
