import { getNotes, serializeNote } from "@/lib/db/notes"
import { AdminNotesTable } from "./AdminNotesTable"

export default async function AdminNotesPage() {
  const { notes } = await getNotes({ limit: 100 })
  const serializedNotes = notes.map(serializeNote)

  return (
    <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Conteúdo</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Para criar notas, acesse <a href="/notes" className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100">/notes</a>.
        </p>
      </div>
      <AdminNotesTable notes={serializedNotes} />
    </>
  )
}
