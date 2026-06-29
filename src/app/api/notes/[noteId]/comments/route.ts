import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createComment, getCommentsPage, serializeComment, MAX_COMMENTS_PER_RESPONSE } from "@/lib/db/comments"
import { getNote } from "@/lib/db/notes"
import { rateLimit } from "@/lib/rate-limit"
import { toObjectId } from "@/lib/validation"
import { parseCommentContent } from "@/lib/api/comment-input"

type Params = { params: Promise<{ noteId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { noteId } = await params
  if (!toObjectId(noteId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const note = await getNote(noteId)
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { comments, hasMore } = await getCommentsPage(noteId)
  return NextResponse.json(comments.map(serializeComment), {
    headers: {
      "X-Comments-Limit": String(MAX_COMMENTS_PER_RESPONSE),
      "X-Comments-Truncated": String(hasMore),
    },
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!rateLimit(`note-comment:${user.id}`, { limit: 12, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 })
  }

  const { noteId } = await params
  if (!toObjectId(noteId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const note = await getNote(noteId)
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json().catch(() => null) as { content?: unknown } | null
  const content = parseCommentContent(body?.content)

  if (!content) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 })
  }

  const comment = await createComment({
    postId: noteId,
    authorId: user.id,
    authorName: user.name,
    authorImageUrl: user.imageUrl,
    content,
  })

  return NextResponse.json(serializeComment(comment), { status: 201 })
}
