import { ObjectId } from "mongodb"
import { randomUUID } from "crypto"
import { getDb } from "./client"
import { calcReadingTime } from "../reading-time"
import { toObjectId } from "../validation"
import {
  isTranslationRevisionStale,
  TRANSLATION_LOCALES,
  type TranslationLocale,
} from "../post-locales"

export type PostStyle = "standard" | "editorial" | "opinion"

export type PostTranslation = {
  title: string
  content: string
  excerpt?: string
  subtitle?: string
  coverAlt?: string
  tags?: string[]
  published: boolean
  publishedAt?: Date
  readingTimeMinutes: number
  sourceUpdatedAt: Date
  createdAt: Date
  updatedAt: Date
}

export type PostTranslations = Partial<Record<TranslationLocale, PostTranslation>>

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
  deleting?: boolean
  style: PostStyle
  originalContentUpdatedAt?: Date
  translations?: PostTranslations
  createdAt: Date
  updatedAt: Date
}

export type PostTranslationSummary = Omit<PostTranslation, "content">
export type PostSummary = Omit<Post, "content" | "translations"> & {
  translations?: Partial<Record<TranslationLocale, PostTranslationSummary>>
}

export type SerializedPostTranslationSummary = Omit<
  PostTranslationSummary,
  "publishedAt" | "sourceUpdatedAt" | "createdAt" | "updatedAt"
> & {
  publishedAt?: string
  sourceUpdatedAt: string
  createdAt: string
  updatedAt: string
}

export type SerializedPostTranslation = SerializedPostTranslationSummary & { content: string }

export type SerializedPostSummary = Omit<
  PostSummary,
  | "_id"
  | "coAuthorUserId"
  | "deleting"
  | "publishedAt"
  | "originalContentUpdatedAt"
  | "translations"
  | "createdAt"
  | "updatedAt"
> & {
  _id: string
  publishedAt?: string
  originalContentUpdatedAt?: string
  translations?: Partial<Record<TranslationLocale, SerializedPostTranslationSummary>>
  createdAt: string
  updatedAt: string
}
export type SerializedPost = Omit<SerializedPostSummary, "translations"> & {
  content: string
  translations?: Partial<Record<TranslationLocale, SerializedPostTranslation>>
}

let indexesPromise: Promise<void> | undefined
let postViewsIndexesPromise: Promise<void> | undefined

type PostView = {
  _id: ObjectId
  publicId: string
  visitorKey: string
  createdAt: Date
}

async function ensurePostIndexes(col: Awaited<ReturnType<typeof collectionRaw>>): Promise<void> {
  const existingIndexes = await col.listIndexes().toArray()
  const textIndex = existingIndexes.find(index => index.key._fts === "text")
  
  if (textIndex && textIndex.name !== "title_text_content_text_tags_text") {
    await col.dropIndex(textIndex.name).catch((error: unknown) => {
      if (!(typeof error === "object" && error && "code" in error && error.code === 27)) throw error
    })
  }

  await Promise.all([
    col.createIndex({ publicId: 1 }, { unique: true, sparse: true }),
    col.createIndex({ slug: 1 }, { unique: true }),
    col.createIndex({ published: 1, publishedAt: -1 }),
    col.createIndex({ title: "text", content: "text", tags: "text" }),
  ])
}

export function getOriginalContentUpdatedAt(post: Pick<Post, "originalContentUpdatedAt" | "updatedAt">): Date {
  return post.originalContentUpdatedAt ?? post.updatedAt
}

export function isPostTranslationStale(
  post: Pick<Post, "originalContentUpdatedAt" | "updatedAt">,
  translation: Pick<PostTranslation, "sourceUpdatedAt">
): boolean {
  return isTranslationRevisionStale(translation.sourceUpdatedAt, getOriginalContentUpdatedAt(post))
}

export function serializePostTranslationSummary(
  translation: PostTranslationSummary
): SerializedPostTranslationSummary {
  return {
    title: translation.title,
    excerpt: translation.excerpt,
    subtitle: translation.subtitle,
    coverAlt: translation.coverAlt,
    tags: translation.tags,
    published: translation.published,
    publishedAt: translation.publishedAt?.toISOString(),
    readingTimeMinutes: translation.readingTimeMinutes,
    sourceUpdatedAt: translation.sourceUpdatedAt.toISOString(),
    createdAt: translation.createdAt.toISOString(),
    updatedAt: translation.updatedAt.toISOString(),
  }
}

export function serializePostTranslation(translation: PostTranslation): SerializedPostTranslation {
  return { ...serializePostTranslationSummary(translation), content: translation.content }
}

function serializeTranslationSummaries(
  translations: PostSummary["translations"],
  includeUnpublished: boolean
): SerializedPostSummary["translations"] {
  if (!translations) return undefined

  const serialized: SerializedPostSummary["translations"] = {}
  for (const locale of TRANSLATION_LOCALES) {
    const translation = translations[locale]
    if (!translation || (!includeUnpublished && !translation.published)) continue
    serialized[locale] = serializePostTranslationSummary(translation)
  }

  return Object.keys(serialized).length > 0 ? serialized : undefined
}

export function serializePostSummary(
  post: PostSummary,
  { includeUnpublishedTranslations = false }: { includeUnpublishedTranslations?: boolean } = {}
): SerializedPostSummary {
  return {
    _id: post._id.toString(),
    publicId: post.publicId,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    subtitle: post.subtitle,
    cover: post.cover,
    showCoverInTimeline: post.showCoverInTimeline,
    friendImage: post.friendImage,
    audioUrl: post.audioUrl,
    background: post.background,
    tags: post.tags,
    pinned: post.pinned,
    published: post.published,
    hiddenFromTimeline: post.hiddenFromTimeline,
    publishedAt: post.publishedAt?.toISOString(),
    readingTimeMinutes: post.readingTimeMinutes,
    views: post.views,
    paragraphCommentsEnabled: post.paragraphCommentsEnabled,
    style: post.style,
    originalContentUpdatedAt: post.originalContentUpdatedAt?.toISOString(),
    translations: serializeTranslationSummaries(post.translations, includeUnpublishedTranslations),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }
}

export function serializePost(
  post: Post,
  { includeUnpublishedTranslations = false }: { includeUnpublishedTranslations?: boolean } = {}
): SerializedPost {
  const translations: SerializedPost["translations"] = {}
  for (const locale of TRANSLATION_LOCALES) {
    const translation = post.translations?.[locale]
    if (!translation || (!includeUnpublishedTranslations && !translation.published)) continue
    translations[locale] = serializePostTranslation(translation)
  }

  return {
    ...serializePostSummary(post, { includeUnpublishedTranslations }),
    content: post.content,
    translations: Object.keys(translations).length > 0 ? translations : undefined,
  }
}

async function collectionRaw() {
  const db = await getDb()
  return db.collection<Post>("posts")
}

async function postViewsCollection() {
  const db = await getDb()
  const col = db.collection<PostView>("post_views")
  postViewsIndexesPromise ??= Promise.all([
    col.createIndex({ publicId: 1, visitorKey: 1 }, { unique: true }),
    col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 8 }),
  ]).then(() => undefined)
  await postViewsIndexesPromise
  return col
}

async function collection() {
  const col = await collectionRaw()
  indexesPromise ??= ensurePostIndexes(col)
  await indexesPromise
  return col
}

export async function ensurePostPublicIds(posts: PostSummary[]): Promise<PostSummary[]> {
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
  filter.deleting = { $ne: true }
  if (!includeUnpublished) filter.published = true
  if (excludeHiddenFromTimeline) filter.hiddenFromTimeline = { $ne: true }
  if (search) {
    filter.$text = { $search: search.trim() }
  }

  const [posts, total] = await Promise.all([
    col
      .find(filter, {
        projection: {
          content: 0,
          "translations.en.content": 0,
          "translations.de.content": 0,
          "translations.id.content": 0,
        },
      })
      .sort({ pinned: -1, publishedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    col.countDocuments(filter),
  ])

  return { posts: await ensurePostPublicIds(posts as PostSummary[]), total }
}

export async function countPosts(opts: {
  includeUnpublished?: boolean
  excludeHiddenFromTimeline?: boolean
  search?: string
} = {}): Promise<number> {
  const filter: Record<string, unknown> = {}
  filter.deleting = { $ne: true }
  if (!opts.includeUnpublished) filter.published = true
  if (opts.excludeHiddenFromTimeline) filter.hiddenFromTimeline = { $ne: true }
  if (opts.search?.trim()) filter.$text = { $search: opts.search.trim() }
  return (await collection()).countDocuments(filter)
}

const publishedVersionFilter = {
  deleting: { $ne: true },
  $or: [
    { published: true },
    { "translations.en.published": true },
    { "translations.de.published": true },
    { "translations.id.published": true },
  ],
}

export async function getPostsWithPublishedVersions({
  page = 1,
  limit = 10,
}: {
  page?: number
  limit?: number
} = {}): Promise<PostSummary[]> {
  const posts = await (await collection())
    .find(publishedVersionFilter, {
      projection: {
        content: 0,
        "translations.en.content": 0,
        "translations.de.content": 0,
        "translations.id.content": 0,
      },
    })
    .sort({ _id: -1 })
    .skip((Math.max(1, page) - 1) * limit)
    .limit(limit)
    .toArray()

  return ensurePostPublicIds(posts as PostSummary[])
}

export async function countPostsWithPublishedVersions(): Promise<number> {
  return (await collection()).countDocuments(publishedVersionFilter)
}

export async function getLatestPublishedPostUpdate(): Promise<Date | undefined> {
  const post = await (await collection()).findOne(
    publishedVersionFilter,
    { sort: { updatedAt: -1 }, projection: { updatedAt: 1 } }
  )
  return post?.updatedAt
}

export async function getPublishedPostTags(): Promise<string[]> {
  const tags = await (await collection()).distinct("tags", {
    published: true,
    deleting: { $ne: true },
  })
  return tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).sort((a, b) => a.localeCompare(b, "pt-BR"))
}

export async function getPublishedTagUpdates(): Promise<Array<{ tag: string; updatedAt: Date }>> {
  const rows = await (await collection()).aggregate<{ _id: string; updatedAt: Date }>([
    { $match: { published: true, deleting: { $ne: true }, tags: { $type: "array", $ne: [] } } },
    { $unwind: "$tags" },
    { $match: { tags: { $type: "string", $ne: "" } } },
    { $group: { _id: "$tags", updatedAt: { $max: "$updatedAt" } } },
    { $sort: { _id: 1 } },
  ]).toArray()
  return rows.map((row) => ({ tag: row._id, updatedAt: row.updatedAt }))
}

export async function getPostsByTag(tag: string, limit = 50): Promise<PostSummary[]> {
  const posts = await (await collection())
    .find(
      { published: true, deleting: { $ne: true }, tags: tag },
      { projection: { content: 0, "translations.en.content": 0, "translations.de.content": 0, "translations.id.content": 0 } }
    )
    .sort({ publishedAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .toArray()
  return ensurePostPublicIds(posts as PostSummary[])
}

export async function getRelatedPosts(post: Pick<Post, "_id" | "tags">, limit = 3): Promise<PostSummary[]> {
  if (post.tags.length === 0) return []
  const posts = await (await collection())
    .find(
      { _id: { $ne: post._id }, published: true, deleting: { $ne: true }, tags: { $in: post.tags } },
      { projection: { content: 0, "translations.en.content": 0, "translations.de.content": 0, "translations.id.content": 0 } }
    )
    .sort({ publishedAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(limit, 6)))
    .toArray()
  return ensurePostPublicIds(posts as PostSummary[])
}

export async function getPostByPublicId(publicId: string): Promise<Post | null> {
  const col = await collection()
  return col.findOne({ publicId, deleting: { $ne: true } })
}

export async function getPostById(id: string): Promise<Post | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null

  const col = await collection()
  return col.findOne({ _id: objectId, deleting: { $ne: true } })
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const col = await collection()
  const post = await col.findOne({ slug, deleting: { $ne: true } })
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

export async function incrementPostViewsOnce(
  publicId: string,
  visitorKey: string
): Promise<{ views: number; counted: boolean }> {
  const viewsCol = await postViewsCollection()

  try {
    await viewsCol.insertOne({
      _id: new ObjectId(),
      publicId,
      visitorKey,
      createdAt: new Date(),
    })
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) {
      const post = await (await collection()).findOne({ publicId }, { projection: { views: 1 } })
      return { views: post?.views ?? 0, counted: false }
    }
    throw error
  }

  return { views: await incrementPostViews(publicId), counted: true }
}

export async function createPost(data: {
  title: string
  content: string
  slug: string
  excerpt?: string
  subtitle?: string
  cover?: Post["cover"]
  showCoverInTimeline?: boolean
  friendImage?: string
  coAuthorUserId?: string | null
  audioUrl?: string
  background?: Post["background"]
  tags?: string[]
  style?: PostStyle
  hiddenFromTimeline?: boolean
  published?: boolean
}): Promise<Post> {
  const col = await collection()
  const now = new Date()
  const post: Omit<Post, "_id"> = {
    publicId: randomUUID(),
    slug: data.slug,
    title: data.title,
    content: data.content,
    excerpt: data.excerpt,
    subtitle: data.subtitle,
    cover: data.cover,
    showCoverInTimeline: data.showCoverInTimeline ?? true,
    friendImage: data.friendImage,
    coAuthorUserId: data.coAuthorUserId ?? null,
    audioUrl: data.audioUrl,
    background: data.background,
    tags: data.tags ?? [],
    pinned: false,
    published: data.published ?? false,
    hiddenFromTimeline: data.hiddenFromTimeline ?? false,
    readingTimeMinutes: calcReadingTime(data.content),
    style: data.style ?? "standard",
    originalContentUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  }
  if (post.published) post.publishedAt = now
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

export async function updatePostTranslation(
  id: string,
  locale: TranslationLocale,
  data: {
    title: string
    content: string
    excerpt?: string
    subtitle?: string
    coverAlt?: string
    tags?: string[]
    published?: boolean
  },
  sourceUpdatedAt: Date,
  existing?: PostTranslation
): Promise<PostTranslation> {
  const objectId = toObjectId(id)
  if (!objectId) throw new Error("Invalid post id")

  const now = new Date()
  const published = data.published ?? existing?.published ?? false
  const translation: PostTranslation = {
    title: data.title,
    content: data.content,
    excerpt: data.excerpt,
    subtitle: data.subtitle,
    coverAlt: data.coverAlt,
    tags: data.tags ?? existing?.tags ?? [],
    published,
    publishedAt: published ? existing?.publishedAt ?? now : undefined,
    readingTimeMinutes: calcReadingTime(data.content),
    sourceUpdatedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  const col = await collection()
  await col.updateOne(
    { _id: objectId, originalContentUpdatedAt: { $exists: false } },
    { $set: { originalContentUpdatedAt: sourceUpdatedAt } }
  )

  const result = await col.updateOne(
    { _id: objectId, deleting: { $ne: true } },
    { $set: { [`translations.${locale}`]: translation } }
  )
  if (result.matchedCount !== 1) throw new Error("Post not found")

  return translation
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

export async function markPostDeleting(id: string): Promise<boolean> {
  const objectId = toObjectId(id)
  if (!objectId) return false
  const result = await (await collection()).updateOne(
    { _id: objectId },
    { $set: { deleting: true, updatedAt: new Date() } }
  )
  return result.matchedCount === 1
}

export async function ensureIndexes(): Promise<void> {
  const col = await collectionRaw()
  await ensurePostIndexes(col)
}
