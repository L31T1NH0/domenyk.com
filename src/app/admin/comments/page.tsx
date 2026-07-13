import { getCommentParentSummaries, getRecentComments, serializeComment } from "@/lib/db/comments"
import { CommentsTable } from "./CommentsTable"

export default async function AdminCommentsPage() {
  const comments = await getRecentComments(50)
  const parents = await getCommentParentSummaries(comments.map((comment) => comment.postId))
  const serializedComments = comments.map((comment) => ({
    ...serializeComment(comment, true),
    parent: parents.get(comment.postId.toString())!,
  }))

  return (
    <>
      <header className="admin-page-header"><div><h1>Comentários</h1><p>Modere as conversas publicadas nos posts e nas notas.</p></div></header>
      <CommentsTable comments={serializedComments} />
    </>
  )
}
