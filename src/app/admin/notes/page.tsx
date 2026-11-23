import { loadAdminNotesPage } from "./data"
import { NotesWorkspace } from "./NotesWorkspace"
export const metadata = { title: "Notas" }
export default async function AdminNotesPage() {
  const { notes } = await loadAdminNotesPage()
  return <NotesWorkspace notes={notes} />
}
