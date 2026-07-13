import { NextRequest, NextResponse } from "next/server"
import { getAdminUserId, getAuthUser, getAuthUserId, isAdmin } from "@/lib/auth"
import { createNotification } from "@/lib/db/notifications"
import { createComment, deleteComment, getCommentsPage, serializeComment, MAX_COMMENTS_PER_RESPONSE } from "@/lib/db/comments"
import { getNote } from "@/lib/db/notes"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"
import { toObjectId } from "@/lib/validation"
import { MAX_COMMENT_IMAGES, parseCommentContent } from "@/lib/api/comment-input"
import {
  claimCommentUploads,
  commentUploadClaimMatches,
  commitCommentUploadClaim,
  extractCommentBlobUrls,
  releaseCommentUploadClaim,
} from "@/lib/db/comment-uploads"

type Params = { params: Promise<{ noteId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { noteId } = await params
  if (!toObjectId(noteId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  if (!(await rateLimit(`comment-read:${requestIdentity(req)}`, { limit: 120, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 })
  }

  const [note, userId, admin] = await Promise.all([getNote(noteId), getAuthUserId(), isAdmin()])
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined
  if (cursor && !toObjectId(cursor)) return NextResponse.json({ error: "Cursor inválido" }, { status: 400 })
  const { comments, hasMore, nextCursor, total } = await getCommentsPage(noteId, { cursor })
  return NextResponse.json(comments.map((comment) =>
    serializeComment(comment, admin || userId === comment.authorId)
  ), {
    headers: {
      "X-Comments-Limit": String(MAX_COMMENTS_PER_RESPONSE),
      "X-Comments-Total": String(total),
      "X-Comments-Truncated": String(hasMore),
      ...(nextCursor ? { "X-Comments-Next-Cursor": nextCursor } : {}),
    },
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await rateLimit(`note-comment:${userId}`, { limit: 12, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 })
  }
  const user = await getAuthUser()
  if (!user || user.id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { noteId } = await params
  if (!toObjectId(noteId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const note = await getNote(noteId)
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json().catch(() => null) as { content?: unknown } | null
  const content = parseCommentContent(body?.content)

  if (!content) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 })
  }

  const expectedImageUrls = extractCommentBlobUrls([content]).slice(0, MAX_COMMENT_IMAGES)
  const uploadClaim = await claimCommentUploads(content, user.id)
  if (!commentUploadClaimMatches(expectedImageUrls, uploadClaim)) {
    await releaseCommentUploadClaim(uploadClaim)
    return NextResponse.json({ error: "Uma ou mais imagens são inválidas ou expiraram." }, { status: 400 })
  }

  let comment
  try {
    comment = await createComment({
      postId: noteId,
      authorId: user.id,
      authorName: user.name,
      authorImageUrl: user.imageUrl,
      content,
    })
  } catch (error) {
    await releaseCommentUploadClaim(uploadClaim).catch(() => undefined)
    throw error
  }
  if (!(await getNote(noteId))) {
    await deleteComment(comment._id.toString()).catch(() => undefined)
    await releaseCommentUploadClaim(uploadClaim).catch(() => undefined)
    return NextResponse.json({ error: "A nota foi removida durante o envio." }, { status: 409 })
  }
  await commitCommentUploadClaim(uploadClaim).catch(() => undefined)

  const adminId = getAdminUserId()
  if (adminId) await createNotification({
    recipientId: adminId, actorId: user.id, kind: "comment",
    title: "Novo comentário em uma nota", description: `${user.name} comentou em uma nota.`, href: `/notes/${noteId}`,
  }).catch(() => null)

  return NextResponse.json(serializeComment(comment, true), { status: 201 })
}
