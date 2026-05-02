import { getRecentComments, serializeComment } from "@/lib/db/comments"
import { CommentsTable } from "./CommentsTable"

export default async function AdminCommentsPage() {
  const comments = await getRecentComments(50)
  const serializedComments = comments.map(serializeComment)

  return (
    <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Moderação</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Comentários</h1>
      </div>
      <CommentsTable comments={serializedComments} />
    </>
  )
}
