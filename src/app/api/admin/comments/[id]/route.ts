import { NextRequest, NextResponse } from "next/server"
import { deleteComment, getComment } from "@/lib/db/comments"
import { getAuthUser, isAdmin } from "@/lib/auth"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, admin, comment] = await Promise.all([getAuthUser(), isAdmin(), getComment(id)])
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!admin && (!user || user.id !== comment.authorId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await deleteComment(id)
  return NextResponse.json({ ok: true })
}
