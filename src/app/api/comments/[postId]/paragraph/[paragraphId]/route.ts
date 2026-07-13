import { NextRequest, NextResponse } from "next/server"
import { getCommentsPage, createComment, deleteComment, serializeComment, MAX_COMMENTS_PER_RESPONSE } from "@/lib/db/comments"
import { getAdminUserId, getAuthUser, getAuthUserId, isAdmin } from "@/lib/auth"
import { createNotification } from "@/lib/db/notifications"
import { getPostById } from "@/lib/db/posts"
import { toObjectId } from "@/lib/validation"
import { rateLimit } from "@/lib/rate-limit"
import { MAX_COMMENT_IMAGES, parseCommentContent } from "@/lib/api/comment-input"
import {
  claimCommentUploads,
  commentUploadClaimMatches,
  commitCommentUploadClaim,
  extractCommentBlobUrls,
  releaseCommentUploadClaim,
} from "@/lib/db/comment-uploads"
import { hasParagraphId } from "@/lib/mdx"
import { requestIdentity } from "@/lib/request-identity"
import { isPostLocale } from "@/lib/post-locales"
import { getPostVersion } from "@/lib/post-versions"

type Params = { params: Promise<{ postId: string; paragraphId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { postId, paragraphId } = await params
  if (!toObjectId(postId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  if (!paragraphId || paragraphId.length > 120) {
    return NextResponse.json({ error: "Parágrafo inválido" }, { status: 400 })
  }
  if (!(await rateLimit(`comment-read:${requestIdentity(req)}`, { limit: 120, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 })
  }

  const [post, admin, userId] = await Promise.all([getPostById(postId), isAdmin(), getAuthUserId()])
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const locale = req.nextUrl.searchParams.get("locale") ?? "pt"
  if (!isPostLocale(locale)) return NextResponse.json({ error: "Idioma inválido" }, { status: 400 })
  const version = getPostVersion(post, locale)
  if (!version || (!version.published && !admin)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!hasParagraphId(version.content, paragraphId)) {
    return NextResponse.json({ error: "Parágrafo inexistente" }, { status: 400 })
  }

  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined
  if (cursor && !toObjectId(cursor)) return NextResponse.json({ error: "Cursor inválido" }, { status: 400 })
  const { comments, hasMore, nextCursor, total } = await getCommentsPage(postId, { paragraphId, cursor })
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
  if (!(await rateLimit(`paragraph-comment:${userId}`, { limit: 20, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 })
  }
  const user = await getAuthUser()
  if (!user || user.id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { postId, paragraphId } = await params
  if (!toObjectId(postId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  if (!paragraphId || paragraphId.length > 120) {
    return NextResponse.json({ error: "Parágrafo inválido" }, { status: 400 })
  }

  const [post, admin] = await Promise.all([getPostById(postId), isAdmin()])
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const locale = req.nextUrl.searchParams.get("locale") ?? "pt"
  if (!isPostLocale(locale)) return NextResponse.json({ error: "Idioma inválido" }, { status: 400 })
  const version = getPostVersion(post, locale)
  if (!version || (!version.published && !admin)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!hasParagraphId(version.content, paragraphId)) {
    return NextResponse.json({ error: "Parágrafo inexistente" }, { status: 400 })
  }

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
      postId,
      paragraphId,
      authorId: user.id,
      authorName: user.name,
      authorImageUrl: user.imageUrl,
      content,
    })
  } catch (error) {
    await releaseCommentUploadClaim(uploadClaim).catch(() => undefined)
    throw error
  }
  const currentPost = await getPostById(postId)
  const currentVersion = currentPost ? getPostVersion(currentPost, locale) : null
  if (!currentVersion || !hasParagraphId(currentVersion.content, paragraphId)) {
    await deleteComment(comment._id.toString()).catch(() => undefined)
    await releaseCommentUploadClaim(uploadClaim).catch(() => undefined)
    return NextResponse.json({ error: "O parágrafo foi removido durante o envio." }, { status: 409 })
  }
  await commitCommentUploadClaim(uploadClaim).catch(() => undefined)

  const adminId = getAdminUserId()
  if (adminId) await createNotification({
    recipientId: adminId, actorId: user.id, kind: "comment",
    title: `Comentário em um trecho de ${version.title}`,
    description: `${user.name} comentou em um parágrafo.`, href: `/posts/${post.slug}#${paragraphId}`,
  }).catch(() => null)

  return NextResponse.json(serializeComment(comment, true), { status: 201 })
}
