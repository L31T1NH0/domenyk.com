import { loadAdminCommentsPage } from "./data"
import { CommentsWorkspace } from "./CommentsWorkspace"
export const metadata = { title: "Comentários" }
export default async function AdminCommentsPage() {
  const { comments } = await loadAdminCommentsPage()
  return <CommentsWorkspace comments={comments} />
}
