import "server-only"

import { ObjectId } from "mongodb"
import { randomUUID } from "crypto"
import { getDb } from "./client"
import type { Post, PostSeriesMembership } from "./posts"
import { toObjectId } from "../validation"

export type EditorialSeries = {
  _id: ObjectId
  publicId: string
  title: string
  slug: string
  description: string
  published: boolean
  postIds: ObjectId[]
  createdAt: Date
  updatedAt: Date
}

export type SerializedEditorialSeries = Omit<
  EditorialSeries,
  "_id" | "postIds" | "createdAt" | "updatedAt"
> & {
  _id: string
  postIds: string[]
  chapterCount: number
  createdAt: string
  updatedAt: string
}

let indexesPromise: Promise<void> | undefined

async function collection() {
  const col = (await getDb()).collection<EditorialSeries>("series")
  indexesPromise ??= Promise.all([
    col.createIndex({ publicId: 1 }, { unique: true }),
    col.createIndex({ slug: 1 }, { unique: true }),
    col.createIndex({ published: 1, updatedAt: -1 }),
  ]).then(() => undefined)
  await indexesPromise
  return col
}

export function serializeSeries(series: EditorialSeries): SerializedEditorialSeries {
  return {
    _id: series._id.toString(),
    publicId: series.publicId,
    title: series.title,
    slug: series.slug,
    description: series.description,
    published: series.published,
    postIds: series.postIds.map((id) => id.toString()),
    chapterCount: series.postIds.length,
    createdAt: series.createdAt.toISOString(),
    updatedAt: series.updatedAt.toISOString(),
  }
}

export async function getSeries({ publishedOnly = false }: { publishedOnly?: boolean } = {}) {
  return (await collection())
    .find(publishedOnly ? { published: true } : {})
    .sort({ updatedAt: -1, _id: -1 })
    .toArray()
}

export async function getSeriesById(id: string): Promise<EditorialSeries | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return (await collection()).findOne({ _id: objectId })
}

export async function getSeriesBySlug(
  slug: string,
  { publishedOnly = false }: { publishedOnly?: boolean } = {}
): Promise<EditorialSeries | null> {
  return (await collection()).findOne(publishedOnly ? { slug, published: true } : { slug })
}

export async function getSeriesByPublicId(
  publicId: string,
  { publishedOnly = false }: { publishedOnly?: boolean } = {}
): Promise<EditorialSeries | null> {
  return (await collection()).findOne(publishedOnly ? { publicId, published: true } : { publicId })
}

export async function getSeriesChapters(
  series: Pick<EditorialSeries, "postIds">,
  { includeUnpublished = false }: { includeUnpublished?: boolean } = {}
): Promise<Post[]> {
  if (series.postIds.length === 0) return []
  const db = await getDb()
  const filter = includeUnpublished
    ? { _id: { $in: series.postIds }, deleting: { $ne: true } }
    : {
        _id: { $in: series.postIds },
        published: true,
        deleting: { $ne: true },
        hiddenFromTimeline: { $ne: true },
      }
  const posts = await db.collection<Post>("posts").find(filter).toArray()
  const byId = new Map(posts.map((post) => [post._id.toString(), post]))
  return series.postIds.flatMap((id) => {
    const post = byId.get(id.toString())
    return post ? [post] : []
  })
}

async function assertPostsExist(postIds: ObjectId[]) {
  if (postIds.length === 0) return
  const db = await getDb()
  const count = await db.collection<Post>("posts").countDocuments({
    _id: { $in: postIds },
    deleting: { $ne: true },
  })
  if (count !== postIds.length) throw new Error("A seleção contém um post inexistente.")
}

async function syncSeriesMembership(series: EditorialSeries) {
  const db = await getDb()
  const seriesCol = db.collection<EditorialSeries>("series")
  const postsCol = db.collection<Post>("posts")
  const now = new Date()
  const selectedIds = new Set(series.postIds.map((id) => id.toString()))
  const competingSeries = series.postIds.length > 0
    ? await seriesCol.find({ _id: { $ne: series._id }, postIds: { $in: series.postIds } }).toArray()
    : []

  if (series.postIds.length > 0) {
    await Promise.all(series.postIds.map((postId) => seriesCol.updateMany(
      { _id: { $ne: series._id }, postIds: postId },
      { $pull: { postIds: postId }, $set: { updatedAt: now } }
    )))
  }

  await postsCol.updateMany(
    {
      "series.id": series.publicId,
      ...(series.postIds.length > 0 ? { _id: { $nin: series.postIds } } : {}),
    },
    { $unset: { series: "" } }
  )

  const membershipWrites = [
    ...series.postIds.map((postId, index) => ({
      updateOne: {
        filter: { _id: postId, deleting: { $ne: true } },
        update: {
          $set: {
            series: {
              id: series.publicId,
              slug: series.slug,
              title: series.title,
              position: index + 1,
              published: series.published,
            },
          },
        },
      },
    })),
    ...competingSeries.flatMap((competing) => competing.postIds
      .filter((postId) => !selectedIds.has(postId.toString()))
      .map((postId, index) => ({
        updateOne: {
          filter: { _id: postId, deleting: { $ne: true } },
          update: {
            $set: {
              series: {
                id: competing.publicId,
                slug: competing.slug,
                title: competing.title,
                position: index + 1,
                published: competing.published,
              },
            },
          },
        },
      }))),
  ]
  if (membershipWrites.length > 0) await postsCol.bulkWrite(membershipWrites)
}

export async function createSeries(data: Pick<EditorialSeries, "title" | "slug" | "description" | "published" | "postIds">) {
  await assertPostsExist(data.postIds)
  const now = new Date()
  const series: Omit<EditorialSeries, "_id"> = {
    ...data,
    publicId: randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  const col = await collection()
  const result = await col.insertOne(series as EditorialSeries)
  const created = { ...series, _id: result.insertedId }
  await syncSeriesMembership(created)
  return created
}

export async function updateSeries(
  id: string,
  data: Pick<EditorialSeries, "title" | "slug" | "description" | "published" | "postIds">
): Promise<EditorialSeries | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  await assertPostsExist(data.postIds)
  const updated = await (await collection()).findOneAndUpdate(
    { _id: objectId },
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: "after" }
  )
  if (updated) await syncSeriesMembership(updated)
  return updated
}

export async function deleteSeries(id: string): Promise<boolean> {
  const objectId = toObjectId(id)
  if (!objectId) return false
  const col = await collection()
  const series = await col.findOne({ _id: objectId })
  if (!series) return false
  const db = await getDb()
  await db.collection<Post>("posts").updateMany(
    { "series.id": series.publicId },
    { $unset: { series: "" } }
  )
  return col.deleteOne({ _id: objectId }).then((result) => result.deletedCount === 1)
}

export async function removePostFromSeries(postId: ObjectId): Promise<void> {
  const col = await collection()
  const affected = await col.find({ postIds: postId }).toArray()
  await col.updateMany(
    { postIds: postId },
    { $pull: { postIds: postId }, $set: { updatedAt: new Date() } }
  )
  const writes = affected.flatMap((series) => series.postIds
    .filter((id) => !id.equals(postId))
    .map((id, index) => ({
      updateOne: {
        filter: { _id: id, deleting: { $ne: true } },
        update: {
          $set: {
            series: {
              id: series.publicId,
              slug: series.slug,
              title: series.title,
              position: index + 1,
              published: series.published,
            },
          },
        },
      },
    })))
  if (writes.length > 0) await (await getDb()).collection<Post>("posts").bulkWrite(writes)
}

export async function setSeriesForPost(
  postId: ObjectId,
  seriesPublicId: string | null
): Promise<PostSeriesMembership | null> {
  const col = await collection()
  const currentSeries = await col.find({ postIds: postId }).toArray()
  const target = seriesPublicId ? await col.findOne({ publicId: seriesPublicId }) : null
  if (seriesPublicId && !target) throw new Error("Série inválida.")

  const currentTarget = target && currentSeries.find((series) => series._id.equals(target._id))
  if (currentTarget && currentSeries.length === 1) {
    return {
      id: currentTarget.publicId,
      slug: currentTarget.slug,
      title: currentTarget.title,
      position: currentTarget.postIds.findIndex((id) => id.equals(postId)) + 1,
      published: currentTarget.published,
    }
  }

  const now = new Date()
  if (currentSeries.length > 0) {
    await col.updateMany(
      { postIds: postId },
      { $pull: { postIds: postId }, $set: { updatedAt: now } }
    )
  }

  const postsCol = (await getDb()).collection<Post>("posts")
  await postsCol.updateOne({ _id: postId }, { $unset: { series: "" } })

  const oldMembershipWrites = currentSeries.flatMap((series) => series.postIds
    .filter((id) => !id.equals(postId))
    .map((id, index) => ({
      updateOne: {
        filter: { _id: id, deleting: { $ne: true } },
        update: {
          $set: {
            series: {
              id: series.publicId,
              slug: series.slug,
              title: series.title,
              position: index + 1,
              published: series.published,
            },
          },
        },
      },
    })))
  if (oldMembershipWrites.length > 0) await postsCol.bulkWrite(oldMembershipWrites)
  if (!target) return null

  const updatedTarget = await col.findOneAndUpdate(
    { _id: target._id },
    { $addToSet: { postIds: postId }, $set: { updatedAt: now } },
    { returnDocument: "after" }
  )
  if (!updatedTarget) throw new Error("Série inválida.")
  const membership: PostSeriesMembership = {
    id: updatedTarget.publicId,
    slug: updatedTarget.slug,
    title: updatedTarget.title,
    position: updatedTarget.postIds.length,
    published: updatedTarget.published,
  }
  await postsCol.updateOne({ _id: postId }, { $set: { series: membership } })
  return membership
}

export async function getPublishedSeriesUpdates() {
  return (await collection())
    .find({ published: true }, { projection: { slug: 1, updatedAt: 1 } })
    .sort({ slug: 1 })
    .toArray()
}
