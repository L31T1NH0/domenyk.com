import { loadAdminNotePage } from "./data"
import { NoteWorkspace } from "../NoteWorkspace"
export const metadata = { title: "Editar nota" }
export default async function AdminNotePage(props: Parameters<typeof loadAdminNotePage>[0]) {
  const { note, metrics } = await loadAdminNotePage(props)
  return <NoteWorkspace note={note} metrics={metrics} />
}
