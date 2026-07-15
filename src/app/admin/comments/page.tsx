import { getCommentParentSummaries, getRecentComments, serializeComment } from "@/lib/db/comments"
import { CommentsTable } from "./CommentsTable"
import { AdminCommandHeader } from "../AdminCommandHeader"

export default async function AdminCommentsPage() {
  const comments = await getRecentComments(50)
  const parents = await getCommentParentSummaries(comments.map((comment) => comment.postId))
  const serializedComments = comments.map((comment) => ({
    ...serializeComment(comment, true),
    parent: parents.get(comment.postId.toString())!,
  }))

  return (
    <>
      <AdminCommandHeader title="Comentários" description="Modere as conversas publicadas nos posts e nas notas." />
      <CommentsTable comments={serializedComments} />
    </>
  )
}
