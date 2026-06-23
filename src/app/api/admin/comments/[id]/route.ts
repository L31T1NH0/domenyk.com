import { NextRequest, NextResponse } from "next/server"
import { deleteComment, getComment } from "@/lib/db/comments"
import { adminOnly } from "@/lib/auth"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const { id } = await params

  const comment = await getComment(id)
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await deleteComment(id)
  return NextResponse.json({ ok: true })
}
