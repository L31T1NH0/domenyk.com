import { getNotes, serializeNote } from "@/lib/db/notes"
import { AdminNotesTable } from "./AdminNotesTable"

export default async function AdminNotesPage() {
  const { notes } = await getNotes({ limit: 100 })
  const serializedNotes = notes.map(serializeNote)

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
