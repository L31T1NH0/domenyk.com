import { ObjectId } from "mongodb"
import { randomUUID } from "crypto"
import { getDb } from "./client"
import { calcReadingTime } from "../reading-time"
import { toObjectId } from "../validation"

export type PostStyle = "standard" | "editorial" | "opinion"

export type Post = {
  _id: ObjectId
  publicId: string
  slug: string
  title: string
  content: string
  excerpt?: string
  subtitle?: string
  cover?: { url: string; alt?: string }
  showCoverInTimeline?: boolean
  friendImage?: string
  coAuthorUserId?: string | null
  audioUrl?: string
  background?: { color?: string; imageUrl?: string }
  tags: string[]
  pinned: boolean
  published: boolean
  hiddenFromTimeline?: boolean
  publishedAt?: Date
  readingTimeMinutes: number
  views?: number
  paragraphCommentsEnabled?: boolean
  style: PostStyle
  createdAt: Date
  updatedAt: Date
}

export type PostSummary = Omit<Post, "content">

export type SerializedPostSummary = Omit<PostSummary, "_id" | "publishedAt" | "createdAt" | "updatedAt"> & {
  _id: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

let indexesPromise: Promise<void> | undefined

async function ensurePostIndexes(col: Awaited<ReturnType<typeof collectionRaw>>): Promise<void> {
  const existingIndexes = await col.listIndexes().toArray()
  const textIndex = existingIndexes.find(index => index.key._fts === "text")
  
  if (textIndex && textIndex.name !== "title_text_content_text") {
    await col.dropIndex(textIndex.name)
  }

  await Promise.all([
    col.createIndex({ publicId: 1 }, { unique: true, sparse: true }),
    col.createIndex({ slug: 1 }, { unique: true }),
    col.createIndex({ published: 1, publishedAt: -1 }),
    col.createIndex({ title: "text", content: "text" }),
  ])
}

export function serializePostSummary(post: PostSummary): SerializedPostSummary {
  return {
    ...post,
    _id: post._id.toString(),
    publishedAt: post.publishedAt?.toISOString(),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }
}

async function collectionRaw() {
  const db = await getDb()
  return db.collection<Post>("posts")
}

async function collection() {
  const col = await collectionRaw()
  indexesPromise ??= ensurePostIndexes(col)
  await indexesPromise
  return col
}

async function ensurePublicIds(posts: PostSummary[]): Promise<PostSummary[]> {
  const missingPublicIds = posts.filter((post) => !post.publicId)
  if (missingPublicIds.length === 0) return posts

  const col = await collection()
  await Promise.all(missingPublicIds.map(async (post) => {
    const publicId = randomUUID()
    const result = await col.updateOne(
      { _id: post._id, publicId: { $exists: false } },
      { $set: { publicId, updatedAt: new Date() } }
    )

    if (result.modifiedCount === 1) {
      post.publicId = publicId
      return
    }

    const freshPost = await col.findOne({ _id: post._id }, { projection: { publicId: 1 } })
    post.publicId = freshPost?.publicId ?? publicId
  }))

  return posts
}

async function ensurePostPublicId(post: Post): Promise<Post> {
  if (post.publicId) return post

  const publicId = randomUUID()
  const col = await collection()
  const result = await col.updateOne(
    { _id: post._id, publicId: { $exists: false } },
    { $set: { publicId, updatedAt: new Date() } }
  )

  if (result.modifiedCount === 1) {
    post.publicId = publicId
    return post
  }

  const freshPost = await col.findOne({ _id: post._id }, { projection: { publicId: 1 } })
  post.publicId = freshPost?.publicId ?? publicId
  return post
}

export async function getPosts(opts: {
  page?: number
  limit?: number
  includeUnpublished?: boolean
  excludeHiddenFromTimeline?: boolean
  search?: string
} = {}): Promise<{ posts: PostSummary[]; total: number }> {
  const {
    page = 1,
    limit = 10,
    includeUnpublished = false,
    excludeHiddenFromTimeline = false,
    search,
  } = opts
  const col = await collection()

  const filter: Record<string, unknown> = {}
  if (!includeUnpublished) filter.published = true
  if (excludeHiddenFromTimeline) filter.hiddenFromTimeline = { $ne: true }
  if (search) filter.$text = { $search: search }

  const [posts, total] = await Promise.all([
    col
      .find(filter, { projection: { content: 0 } })
      .sort({ pinned: -1, publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    col.countDocuments(filter),
  ])

  return { posts: await ensurePublicIds(posts as PostSummary[]), total }
}

export async function getPostByPublicId(publicId: string): Promise<Post | null> {
  const col = await collection()
  return col.findOne({ publicId })
}

export async function getPostById(id: string): Promise<Post | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null

  const col = await collection()
  return col.findOne({ _id: objectId })
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const col = await collection()
  const post = await col.findOne({ slug })
  return post ? ensurePostPublicId(post) : null
}

export async function incrementPostViews(publicId: string): Promise<number> {
  const col = await collection()
  const result = await col.findOneAndUpdate(
    { publicId },
    { $inc: { views: 1 } },
    { returnDocument: "after", projection: { views: 1 } }
  )
  return result?.views ?? 0
}

export async function createPost(data: {
  title: string
  content: string
  slug: string
  excerpt?: string
  cover?: Post["cover"]
  showCoverInTimeline?: boolean
  friendImage?: string
  coAuthorUserId?: string | null
  audioUrl?: string
  background?: Post["background"]
  tags?: string[]
  style?: PostStyle
  hiddenFromTimeline?: boolean
}): Promise<Post> {
  const col = await collection()
  const now = new Date()
  const post: Omit<Post, "_id"> = {
    publicId: randomUUID(),
    slug: data.slug,
    title: data.title,
    content: data.content,
    excerpt: data.excerpt,
    cover: data.cover,
    showCoverInTimeline: data.showCoverInTimeline ?? true,
    friendImage: data.friendImage,
    coAuthorUserId: data.coAuthorUserId ?? null,
    audioUrl: data.audioUrl,
    background: data.background,
    tags: data.tags ?? [],
    pinned: false,
    published: false,
    hiddenFromTimeline: data.hiddenFromTimeline ?? false,
    readingTimeMinutes: calcReadingTime(data.content),
    style: data.style ?? "standard",
    createdAt: now,
    updatedAt: now,
  }
  const result = await col.insertOne(post as Post)
  return { ...post, _id: result.insertedId }
}

export async function updatePost(
  id: string,
  data: Partial<Omit<Post, "_id" | "createdAt">>
): Promise<void> {
  const objectId = toObjectId(id)
  if (!objectId) throw new Error("Invalid post id")

  const col = await collection()
  const $set: Record<string, unknown> = { updatedAt: new Date() }
  const $unset: Record<string, ""> = {}

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      $unset[key] = ""
    } else {
      $set[key] = value
    }
  }

  if (data.content) $set.readingTimeMinutes = calcReadingTime(data.content)

  await col.updateOne(
    { _id: objectId },
    Object.keys($unset).length > 0 ? { $set, $unset } : { $set }
  )
}

export async function publishPost(id: string, publish: boolean): Promise<void> {
  const objectId = toObjectId(id)
  if (!objectId) throw new Error("Invalid post id")

  const col = await collection()
  const $set: Record<string, unknown> = {
    published: publish,
    updatedAt: new Date(),
  }
  const update: { $set: Record<string, unknown>; $unset?: Record<string, ""> } = { $set }

  if (publish) {
    $set.publishedAt = new Date()
  } else {
    update.$unset = { publishedAt: "" }
  }

  await col.updateOne({ _id: objectId }, update)
}

export async function deletePost(id: string): Promise<boolean> {
  const objectId = toObjectId(id)
  if (!objectId) throw new Error("Invalid post id")

  const col = await collection()
  const result = await col.deleteOne({ _id: objectId })
  return result.deletedCount === 1
}

export async function ensureIndexes(): Promise<void> {
  const col = await collectionRaw()
  await ensurePostIndexes(col)
}
