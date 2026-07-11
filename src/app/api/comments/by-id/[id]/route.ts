import { NextRequest, NextResponse } from "next/server"
import { deleteComment, getComment } from "@/lib/db/comments"
import { getAuthUserId, isAdmin } from "@/lib/auth"
import { deleteCommentImagesFromContent, queueCommentImagesForCleanup } from "@/lib/db/comment-uploads"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [userId, admin] = await Promise.all([getAuthUserId(), isAdmin()])
  if (!userId && !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const comment = await getComment(id)
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!admin && userId !== comment.authorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await queueCommentImagesForCleanup([comment.content])
  await deleteComment(id)
  await deleteCommentImagesFromContent(comment.content)
  return NextResponse.json({ ok: true })
}
