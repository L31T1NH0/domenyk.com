import { NextRequest, NextResponse } from "next/server"
import { isAdmin } from "@/lib/auth"
import { getParagraphCommentCounts } from "@/lib/db/comments"
import { getPostById } from "@/lib/db/posts"
import { toObjectId } from "@/lib/validation"

type Params = { params: Promise<{ postId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { postId } = await params
  if (!toObjectId(postId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const body = await req.json().catch(() => null) as { paragraphIds?: unknown } | null
  const paragraphIds = Array.isArray(body?.paragraphIds)
    ? body.paragraphIds
      .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 120)
      .slice(0, 300)
    : []

  const [post, admin] = await Promise.all([getPostById(postId), isAdmin()])
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!post.published && !admin) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (paragraphIds.length === 0) return NextResponse.json({})

  const counts = await getParagraphCommentCounts(postId, paragraphIds)
  return NextResponse.json(Object.fromEntries(counts))
}
