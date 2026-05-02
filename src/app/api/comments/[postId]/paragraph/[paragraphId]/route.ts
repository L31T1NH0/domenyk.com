import { NextRequest, NextResponse } from "next/server"
import { getComments, createComment, serializeComment } from "@/lib/db/comments"
import { getAuthUser, isAdmin } from "@/lib/auth"
import { getPostById } from "@/lib/db/posts"
import { asString, toObjectId } from "@/lib/validation"
import { rateLimit } from "@/lib/rate-limit"

type Params = { params: Promise<{ postId: string; paragraphId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { postId, paragraphId } = await params
  if (!toObjectId(postId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  if (!paragraphId || paragraphId.length > 120) {
    return NextResponse.json({ error: "Parágrafo inválido" }, { status: 400 })
  }

  const [post, admin] = await Promise.all([getPostById(postId), isAdmin()])
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!post.published && !admin) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const comments = await getComments(postId, paragraphId)
  return NextResponse.json(comments.map(serializeComment))
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!rateLimit(`paragraph-comment:${user.id}`, { limit: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 })
  }

  const { postId, paragraphId } = await params
  if (!toObjectId(postId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  if (!paragraphId || paragraphId.length > 120) {
    return NextResponse.json({ error: "Parágrafo inválido" }, { status: 400 })
  }

  const [post, admin] = await Promise.all([getPostById(postId), isAdmin()])
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!post.published && !admin) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json().catch(() => null) as { content?: unknown } | null
  const content = asString(body?.content, 1000)

  if (!content) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 })
  }

  const comment = await createComment({
    postId,
    paragraphId,
    authorId: user.id,
    authorName: user.name,
    authorImageUrl: user.imageUrl,
    content,
  })

  return NextResponse.json(serializeComment(comment), { status: 201 })
}
