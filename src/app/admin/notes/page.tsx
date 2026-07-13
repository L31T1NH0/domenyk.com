import { getNotes, serializeNote } from "@/lib/db/notes"
import { AdminNotesTable } from "./AdminNotesTable"
import { getNoteMetricsMap } from "@/lib/db/note-metrics"

export default async function AdminNotesPage() {
  const { notes } = await getNotes({ limit: 100 })
  const metrics = await getNoteMetricsMap(notes.map((note) => note._id))
  const serializedNotes = notes.map((note) => ({
    ...serializeNote(note),
    metrics: metrics.get(note._id.toString()) ?? { directViews: 0, homeImpressions: 0, notesImpressions: 0 },
  }))

  return (
    <>
      <header className="admin-page-header"><div>
        <h1>Notas</h1>
        <p>Revise conteúdo e libere a indexação somente quando o SEO estiver completo.</p>
      </div></header>
      <AdminNotesTable notes={serializedNotes} />
      <p className="admin-page-note">Novas notas começam fora do Google. Abra uma nota para preencher título e descrição SEO.</p>
    </>
  )
}
