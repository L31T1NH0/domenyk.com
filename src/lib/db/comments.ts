import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { renderMarkdownSync } from "../mdx"
import { toObjectId } from "../validation"

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

export type SerializedComment = Omit<Comment, "_id" | "postId" | "createdAt" | "updatedAt"> & {
  _id: string
  postId: string
  createdAt: string
  updatedAt: string
  contentHtml: string
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

  return {
    ...comment,
    postId: comment.postId ?? new ObjectId(),
    authorId: comment.authorId ?? "",
    authorName,
    authorImageUrl: comment.authorImageUrl ?? "",
    content,
    createdAt,
    updatedAt,
  }
}

export function serializeComment(comment: Comment): SerializedComment {
  return {
    ...comment,
    _id: comment._id.toString(),
    postId: comment.postId.toString(),
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    contentHtml: renderMarkdownSync(comment.content),
  }
}

let indexesPromise: Promise<void> | undefined
export const MAX_COMMENTS_PER_RESPONSE = 100

async function collectionRaw() {
  const db = await getDb()
  return db.collection<StoredComment>("comments")
}

async function collection() {
  const col = await collectionRaw()
  indexesPromise ??= col.createIndex({ postId: 1, paragraphId: 1 }).then(() => undefined)
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
  opts: { paragraphId?: string; limit?: number } = {}
): Promise<{ comments: Comment[]; hasMore: boolean }> {
  const { paragraphId, limit = MAX_COMMENTS_PER_RESPONSE } = opts
  const objectId = toObjectId(postId)
  if (!objectId) return { comments: [], hasMore: false }

  const col = await collection()
  const filter: Record<string, unknown> = { postId: objectId }
  if (paragraphId !== undefined) filter.paragraphId = paragraphId
  else filter.$or = [{ paragraphId: { $exists: false } }, { paragraphId: null }]
  const boundedLimit = Math.max(1, Math.min(limit, MAX_COMMENTS_PER_RESPONSE))
  const comments = await col.find(filter).sort({ createdAt: 1 }).limit(boundedLimit + 1).toArray()
  const hasMore = comments.length > boundedLimit
  if (hasMore) comments.pop()
  return { comments: comments.map(normalizeComment), hasMore }
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

export async function getRecentComments(limit = 20): Promise<Comment[]> {
  const col = await collection()
  const comments = await col.find({}).sort({ createdAt: -1 }).limit(limit).toArray()
  return comments.map(normalizeComment)
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
  await col.createIndex({ postId: 1, paragraphId: 1 })
}
