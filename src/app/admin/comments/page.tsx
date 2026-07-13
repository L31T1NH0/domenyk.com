import { getRecentComments, serializeComment } from "@/lib/db/comments"
import { CommentsTable } from "./CommentsTable"

export default async function AdminCommentsPage() {
  const comments = await getRecentComments(50)
  const serializedComments = comments.map((comment) => serializeComment(comment, true))

  return (
    <>
      <header className="admin-page-header"><div><h1>Comentários</h1><p>Modere as conversas publicadas nos posts e nas notas.</p></div></header>
      <CommentsTable comments={serializedComments} />
    </>
  )
}
