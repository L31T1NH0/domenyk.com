import Link from "next/link"
import { getNotes, serializeNote } from "@/lib/db/notes"
import { AdminNotesTable } from "./AdminNotesTable"

export default async function AdminNotesPage() {
  const { notes } = await getNotes({ limit: 100 })
  const serializedNotes = notes.map(serializeNote)

  return (
    <>
      <header className="admin-page-header"><div>
        <h1>Notas</h1>
        <p>
          Para criar notas, acesse <Link href="/notes" className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100">/notes</Link>.
        </p>
      </div></header>
      <AdminNotesTable notes={serializedNotes} />
    </>
  )
}
