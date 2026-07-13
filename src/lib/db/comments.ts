import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { renderMarkdownSync, type MarkdownRenderOptions } from "../mdx"
import { toObjectId } from "../validation"
import { MAX_COMMENT_IMAGES } from "@/lib/api/comment-input"
import { noteDisplayTitle } from "../seo"

export type Comment = {
  _id: ObjectId
  postId: ObjectId
  paragraphId?: string
  authorId: string
  authorName: string
  authorImageUrl: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export type SerializedComment = Omit<Comment, "_id" | "postId" | "authorId" | "createdAt" | "updatedAt"> & {
  _id: string
  postId: string
  createdAt: string
  updatedAt: string
  contentHtml: string
  canDelete: boolean
}

export type CommentParentSummary = {
  id: string
  type: "post" | "note" | "removed"
  title: string
  adminHref?: string
  publicHref?: string
}

type StoredComment = Partial<Comment> & {
  _id: ObjectId
  content?: unknown
  nome?: unknown
  text?: unknown
  body?: unknown
  comentario?: unknown
  message?: unknown
}

function toDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  return fallback
}

function normalizeComment(comment: StoredComment): Comment {
  const content =
    typeof comment.content === "string" ? comment.content :
    typeof comment.comentario === "string" ? comment.comentario :
    typeof comment.text === "string" ? comment.text :
    typeof comment.body === "string" ? comment.body :
    typeof comment.message === "string" ? comment.message :
    ""
  const authorName =
    typeof comment.authorName === "string" ? comment.authorName :
    typeof comment.nome === "string" ? comment.nome :
    "Anônimo"
  const createdAt = toDate(comment.createdAt)
  const updatedAt = toDate(comment.updatedAt, createdAt)

  const normalized: Comment = {
    _id: comment._id,
    postId: comment.postId ?? new ObjectId(),
    authorId: comment.authorId ?? "",
    authorName,
    authorImageUrl: comment.authorImageUrl ?? "",
    content,
    createdAt,
    updatedAt,
  }
  if (typeof comment.paragraphId === "string") normalized.paragraphId = comment.paragraphId
  return normalized
}

export function serializeComment(comment: Comment, canDelete = false): SerializedComment {
  return {
    _id: comment._id.toString(),
    postId: comment.postId.toString(),
    paragraphId: comment.paragraphId,
    authorName: comment.authorName,
    authorImageUrl: comment.authorImageUrl,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    contentHtml: renderMarkdownSync(comment.content, commentMarkdownOptions(comment.content)),
    canDelete,
  }
}

let indexesPromise: Promise<void> | undefined
export const MAX_COMMENTS_PER_RESPONSE = 50

function commentMarkdownOptions(content: string): MarkdownRenderOptions {
  const allowedUrlPrefixes = new Set<string>()
  const urlPattern = /https:\/\/[^\s)"'<>]+/g

  for (const candidate of content.match(urlPattern) ?? []) {
    try {
      const url = new URL(candidate)
      if (
        url.protocol === "https:" &&
        url.hostname.endsWith(".public.blob.vercel-storage.com") &&
        url.pathname.startsWith("/comments/")
      ) {
        allowedUrlPrefixes.add(`${url.origin}/comments/`)
      }
    } catch {
      // Invalid URLs are removed by the restricted Markdown renderer.
    }
  }

  return {
    imagePolicy: {
      mode: "allowlist",
      allowedUrlPrefixes: [...allowedUrlPrefixes],
      maxImages: MAX_COMMENT_IMAGES,
    },
  }
}

async function collectionRaw() {
  const db = await getDb()
  return db.collection<StoredComment>("comments")
}

async function collection() {
  const col = await collectionRaw()
  indexesPromise ??= col.createIndex({ postId: 1, paragraphId: 1, _id: -1 }).then(() => undefined)
  await indexesPromise
  return col
}

export async function getComments(
  postId: string,
  paragraphId?: string
): Promise<Comment[]> {
  return (await getCommentsPage(postId, { paragraphId })).comments
}

export async function getCommentsPage(
  postId: string,
  opts: { paragraphId?: string; limit?: number; cursor?: string } = {}
): Promise<{ comments: Comment[]; hasMore: boolean; nextCursor: string | null; total: number }> {
  const { paragraphId, limit = MAX_COMMENTS_PER_RESPONSE, cursor } = opts
  const objectId = toObjectId(postId)
  if (!objectId) return { comments: [], hasMore: false, nextCursor: null, total: 0 }

  const col = await collection()
  const baseFilter: Record<string, unknown> = { postId: objectId }
  if (paragraphId !== undefined) baseFilter.paragraphId = paragraphId
  else baseFilter.$or = [{ paragraphId: { $exists: false } }, { paragraphId: null }]
  const filter: Record<string, unknown> = { ...baseFilter }
  if (cursor) {
    const cursorId = toObjectId(cursor)
    if (!cursorId) return { comments: [], hasMore: false, nextCursor: null, total: 0 }
    filter._id = { $lt: cursorId }
  }
  const boundedLimit = Math.max(1, Math.min(limit, MAX_COMMENTS_PER_RESPONSE))
  const [comments, total] = await Promise.all([
    col.find(filter).sort({ _id: -1 }).limit(boundedLimit + 1).toArray(),
    col.countDocuments(baseFilter),
  ])
  const hasMore = comments.length > boundedLimit
  if (hasMore) comments.pop()
  const nextCursor = hasMore && comments.length > 0 ? comments[comments.length - 1]._id.toString() : null
  comments.reverse()
  return { comments: comments.map(normalizeComment), hasMore, nextCursor, total }
}

export async function getComment(id: string): Promise<Comment | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null

  const col = await collection()
  const comment = await col.findOne({ _id: objectId })
  return comment ? normalizeComment(comment) : null
}

export async function createComment(data: {
  postId: string
  paragraphId?: string
  authorId: string
  authorName: string
  authorImageUrl: string
  content: string
}): Promise<Comment> {
  const postObjectId = toObjectId(data.postId)
  if (!postObjectId) throw new Error("Invalid post id")

  const col = await collection()
  const now = new Date()
  const comment: Omit<Comment, "_id"> = {
    postId: postObjectId,
    authorId: data.authorId,
    authorName: data.authorName,
    authorImageUrl: data.authorImageUrl,
    content: data.content,
    createdAt: now,
    updatedAt: now,
  }
  if (data.paragraphId !== undefined) comment.paragraphId = data.paragraphId
  const result = await col.insertOne(comment as Comment)
  return { ...comment, _id: result.insertedId }
}

export async function deleteComment(id: string): Promise<void> {
  const objectId = toObjectId(id)
  if (!objectId) return

  const col = await collection()
  await col.deleteOne({ _id: objectId })
}

export async function deleteCommentsForParent(parentId: string): Promise<Comment[]> {
  const objectId = toObjectId(parentId)
  if (!objectId) return []

  const col = await collection()
  const comments = await col.find({ postId: objectId }).toArray()
  if (comments.length > 0) await col.deleteMany({ postId: objectId })
  return comments.map(normalizeComment)
}

export async function getCommentsForParent(parentId: string): Promise<Comment[]> {
  const objectId = toObjectId(parentId)
  if (!objectId) return []
  const comments = await (await collection()).find({ postId: objectId }).toArray()
  return comments.map(normalizeComment)
}

export async function getRecentComments(limit = 20): Promise<Comment[]> {
  const col = await collection()
  const comments = await col.find({}).sort({ createdAt: -1 }).limit(limit).toArray()
  return comments.map(normalizeComment)
}

export async function getCommentParentSummaries(parentIds: ObjectId[]): Promise<Map<string, CommentParentSummary>> {
  const uniqueIds = [...new Map(parentIds.map((id) => [id.toString(), id])).values()]
  const summaries = new Map<string, CommentParentSummary>()
  if (uniqueIds.length === 0) return summaries

  const db = await getDb()
  const [posts, notes] = await Promise.all([
    db.collection<{ _id: ObjectId; title: string; slug: string; deleting?: boolean }>("posts")
      .find({ _id: { $in: uniqueIds }, deleting: { $ne: true } }, { projection: { title: 1, slug: 1 } })
      .toArray(),
    db.collection<{ _id: ObjectId; title?: string; content: string; deleting?: boolean }>("notes")
      .find({ _id: { $in: uniqueIds }, deleting: { $ne: true } }, { projection: { title: 1, content: 1 } })
      .toArray(),
  ])

  for (const post of posts) {
    const id = post._id.toString()
    summaries.set(id, {
      id,
      type: "post",
      title: post.title,
      adminHref: `/admin/posts/${id}`,
      publicHref: `/posts/${encodeURIComponent(post.slug)}`,
    })
  }

  for (const note of notes) {
    const id = note._id.toString()
    if (summaries.has(id)) continue
    summaries.set(id, {
      id,
      type: "note",
      title: noteDisplayTitle(note),
      adminHref: `/admin/notes/${id}`,
      publicHref: `/notes/${id}`,
    })
  }

  for (const id of uniqueIds) {
    const value = id.toString()
    if (!summaries.has(value)) summaries.set(value, { id: value, type: "removed", title: "Conteúdo removido" })
  }

  return summaries
}

export async function getCommentCountsByAuthor(authorIds: string[]): Promise<Map<string, number>> {
  if (authorIds.length === 0) return new Map()

  const col = await collection()
  const counts = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { authorId: { $in: authorIds } } },
      { $group: { _id: "$authorId", count: { $sum: 1 } } },
    ])
    .toArray()

  return new Map(counts.map((item) => [item._id, item.count]))
}

export async function getParagraphCommentCounts(
  postId: string,
  paragraphIds: string[]
): Promise<Map<string, number>> {
  const objectId = toObjectId(postId)
  if (!objectId || paragraphIds.length === 0) return new Map()

  const col = await collection()
  const counts = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { postId: objectId, paragraphId: { $in: paragraphIds } } },
      { $group: { _id: "$paragraphId", count: { $sum: 1 } } },
    ])
    .toArray()

  return new Map(counts.map((item) => [item._id, item.count]))
}

export async function ensureIndexes(): Promise<void> {
  const col = await collectionRaw()
  await col.createIndex({ postId: 1, paragraphId: 1, _id: -1 })
}
