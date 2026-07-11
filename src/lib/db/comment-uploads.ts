import "server-only"

import { randomUUID } from "node:crypto"
import type { Filter, ObjectId } from "mongodb"
import { deleteImage } from "@/lib/blob"
import { getDb } from "@/lib/db/client"

type CommentUploadState = "pending" | "reserved" | "deleting"

type CommentUpload = {
  url: string
  ownerId: string
  createdAt: Date
  expiresAt: Date
  state?: CommentUploadState
  reservationId?: string
  reservationExpiresAt?: Date
  cleanupId?: string
  cleanupLeaseExpiresAt?: Date
  usedAt?: Date
}

type StoredCommentReference = {
  _id: ObjectId
  content?: string
}

export type CommentUploadClaim = Readonly<{
  id: string
  ownerId: string
  urls: readonly string[]
}>

export function commentUploadClaimMatches(
  expectedUrls: readonly string[],
  claim: CommentUploadClaim | null
): boolean {
  const claimedUrls = claim?.urls ?? []
  if (expectedUrls.length !== claimedUrls.length) return false
  const claimed = new Set(claimedUrls)
  return expectedUrls.every((url) => claimed.has(url))
}

export type CommentUploadCleanupResult = {
  deleted: number
  preserved: number
  failed: number
  hasMore: boolean
}

export type CommentImageCleanupResult = Omit<CommentUploadCleanupResult, "hasMore">

const PENDING_UPLOAD_TTL_MS = 60 * 60 * 1000
const RESERVATION_TTL_MS = 10 * 60 * 1000
const CLEANUP_LEASE_MS = 2 * 60 * 1000
const CLEANUP_RETRY_DELAY_MS = 60 * 1000
const DELETION_OUTBOX_DELAY_MS = 5 * 60 * 1000
const DEFAULT_CLEANUP_BUDGET_MS = 1_500
const MAX_CLEANUP_BUDGET_MS = 30_000
const MAX_CLEANUP_CONCURRENCY = 4
const COMMENT_BLOB_URL_PATTERN =
  /https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/comments\/[a-z0-9._~!$&*+,;=:@%/-]+/gi

let indexesPromise: Promise<void> | undefined

function pendingStateFilter(): Filter<CommentUpload> {
  return {
    $or: [
      { state: "pending" },
      { state: { $exists: false }, usedAt: { $exists: false } },
    ],
  }
}

async function collection() {
  const db = await getDb()
  const col = db.collection<CommentUpload>("comment_uploads")
  indexesPromise ??= (async () => {
    await Promise.all([
      col.createIndex({ url: 1 }, { unique: true }),
      col.createIndex({ ownerId: 1, state: 1, expiresAt: 1 }),
      col.createIndex({ state: 1, reservationExpiresAt: 1 }),
      col.createIndex({ state: 1, cleanupLeaseExpiresAt: 1 }),
    ])

    // Older versions retained one document for every used image forever. Once an
    // upload is committed, the comment content itself is the source of truth.
    await col.deleteMany({ usedAt: { $exists: true } })
  })()
  await indexesPromise
  return col
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function isReferencedByComment(url: string): Promise<boolean> {
  const db = await getDb()
  const comments = db.collection<StoredCommentReference>("comments")
  const match = await comments.findOne(
    { content: { $regex: escapeRegExp(url) } },
    { projection: { _id: 1 } }
  )
  return match !== null
}

async function queueCommentImageCleanup(
  url: string,
  delayMs = CLEANUP_RETRY_DELAY_MS
): Promise<void> {
  const now = new Date()
  await (await collection()).updateOne(
    { url },
    {
      $set: {
        ownerId: "__cleanup__",
        expiresAt: new Date(now.getTime() + Math.max(0, delayMs)),
        state: "pending",
      },
      $setOnInsert: { createdAt: now },
      $unset: {
        reservationId: "",
        reservationExpiresAt: "",
        cleanupId: "",
        cleanupLeaseExpiresAt: "",
        usedAt: "",
      },
    },
    { upsert: true }
  )
}

export async function queueCommentImagesForCleanup(contents: Iterable<string>): Promise<void> {
  const urls = extractCommentBlobUrls(contents)
  if (urls.length === 0) return

  const col = await collection()
  for (let offset = 0; offset < urls.length; offset += 500) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + DELETION_OUTBOX_DELAY_MS)
    await col.bulkWrite(
      urls.slice(offset, offset + 500).map((url) => ({
        updateOne: {
          filter: { url },
          update: {
            $set: { ownerId: "__cleanup__", expiresAt, state: "pending" as const },
            $setOnInsert: { createdAt: now },
            $unset: {
              reservationId: "",
              reservationExpiresAt: "",
              cleanupId: "",
              cleanupLeaseExpiresAt: "",
              usedAt: "",
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    )
  }
}

export function extractCommentBlobUrls(contents: Iterable<string>): string[] {
  const urls = new Set<string>()
  for (const content of contents) {
    for (const match of content.matchAll(COMMENT_BLOB_URL_PATTERN)) {
      urls.add(match[0])
    }
  }
  return [...urls]
}

export async function recordCommentUpload(url: string, ownerId: string): Promise<void> {
  const now = new Date()
  await (await collection()).insertOne({
    url,
    ownerId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + PENDING_UPLOAD_TTL_MS),
    state: "pending",
  })
}

/**
 * Reserves the caller's pending uploads before a comment is created. The
 * reservation prevents cleanup from racing the database write.
 */
export async function claimCommentUploads(
  content: string,
  ownerId: string
): Promise<CommentUploadClaim | null> {
  const col = await collection()
  const now = new Date()
  const requestedUrls = extractCommentBlobUrls([content]).slice(0, 4)
  if (requestedUrls.length === 0) return null

  const candidates = await col.find({
    $and: [
      { ownerId, url: { $in: requestedUrls }, expiresAt: { $gt: now } },
      pendingStateFilter(),
    ],
  }, { projection: { url: 1 } }).toArray()
  const availableUrls = new Set(candidates.map((upload) => upload.url))
  const candidateUrls = requestedUrls.filter((url) => availableUrls.has(url))

  if (candidateUrls.length === 0) return null

  const reservationId = randomUUID()
  await col.updateMany(
    {
      $and: [
        { ownerId, url: { $in: candidateUrls }, expiresAt: { $gt: now } },
        pendingStateFilter(),
      ],
    },
    {
      $set: {
        state: "reserved",
        reservationId,
        reservationExpiresAt: new Date(now.getTime() + RESERVATION_TTL_MS),
      },
    }
  )

  const reserved = await col.find(
    { ownerId, state: "reserved", reservationId },
    { projection: { url: 1 } }
  ).toArray()
  if (reserved.length === 0) return null

  return {
    id: reservationId,
    ownerId,
    urls: reserved.map((upload) => upload.url),
  }
}

/** Removes transient tracking after the comment has been stored successfully. */
export async function commitCommentUploadClaim(
  claim: CommentUploadClaim | null
): Promise<void> {
  if (!claim || claim.urls.length === 0) return

  const col = await collection()
  await col.deleteMany({
    ownerId: claim.ownerId,
    state: "reserved",
    reservationId: claim.id,
    url: { $in: [...claim.urls] },
  })

  const unresolved = await col.countDocuments({
    ownerId: claim.ownerId,
    url: { $in: [...claim.urls] },
  }, { limit: 1 })
  if (unresolved > 0) {
    throw new Error("Unable to commit all comment uploads")
  }
}

/** Restores a reservation after the comment write fails. */
export async function releaseCommentUploadClaim(
  claim: CommentUploadClaim | null
): Promise<void> {
  if (!claim || claim.urls.length === 0) return

  await (await collection()).updateMany(
    {
      ownerId: claim.ownerId,
      state: "reserved",
      reservationId: claim.id,
      url: { $in: [...claim.urls] },
    },
    {
      $set: { state: "pending" },
      $unset: { reservationId: "", reservationExpiresAt: "" },
    }
  )
}

async function releaseExpiredReservations(now: Date): Promise<void> {
  await (await collection()).updateMany(
    { state: "reserved", reservationExpiresAt: { $lte: now } },
    {
      $set: { state: "pending" },
      $unset: { reservationId: "", reservationExpiresAt: "" },
    }
  )
}

async function acquireExpiredUpload(): Promise<CommentUpload | null> {
  const col = await collection()
  const now = new Date()
  const cleanupId = randomUUID()
  return col.findOneAndUpdate(
    {
      $or: [
        {
          $and: [
            pendingStateFilter(),
            { expiresAt: { $lte: now } },
          ],
        },
        {
          $and: [
            { state: "deleting" },
            {
              $or: [
                { cleanupLeaseExpiresAt: { $lte: now } },
                { cleanupLeaseExpiresAt: { $exists: false } },
              ],
            },
          ],
        },
      ],
    },
    {
      $set: {
        state: "deleting",
        cleanupId,
        cleanupLeaseExpiresAt: new Date(now.getTime() + CLEANUP_LEASE_MS),
      },
      $unset: { reservationId: "", reservationExpiresAt: "" },
    },
    { returnDocument: "after", sort: { expiresAt: 1 } }
  )
}

async function cleanupLeasedUpload(
  upload: CommentUpload
): Promise<"deleted" | "preserved" | "failed"> {
  const col = await collection()
  const leaseFilter = {
    url: upload.url,
    state: "deleting" as const,
    cleanupId: upload.cleanupId,
  }

  try {
    if (await isReferencedByComment(upload.url)) {
      await col.deleteOne(leaseFilter)
      return "preserved"
    }

    await deleteImage(upload.url)
    await col.deleteOne(leaseFilter)
    return "deleted"
  } catch {
    await col.updateOne(
      leaseFilter,
      {
        $set: {
          cleanupLeaseExpiresAt: new Date(Date.now() + CLEANUP_RETRY_DELAY_MS),
        },
        $unset: { cleanupId: "" },
      }
    ).catch(() => undefined)
    return "failed"
  }
}

/**
 * Cleans expired uploads using short atomic leases. Work is time-bounded rather
 * than item-bounded, so a large backlog keeps making progress without allowing
 * one request to run indefinitely. A cron route can pass a larger budget.
 */
export async function cleanupExpiredCommentUploads(
  options: { maxDurationMs?: number; concurrency?: number } = {}
): Promise<CommentUploadCleanupResult> {
  const maxDurationMs = Math.max(
    100,
    Math.min(options.maxDurationMs ?? DEFAULT_CLEANUP_BUDGET_MS, MAX_CLEANUP_BUDGET_MS)
  )
  const concurrency = Math.max(
    1,
    Math.min(Math.floor(options.concurrency ?? 2), MAX_CLEANUP_CONCURRENCY)
  )
  const deadline = Date.now() + maxDurationMs
  const result = { deleted: 0, preserved: 0, failed: 0 }

  await releaseExpiredReservations(new Date())

  const worker = async () => {
    while (Date.now() < deadline) {
      const upload = await acquireExpiredUpload()
      if (!upload) return

      const outcome = await cleanupLeasedUpload(upload)
      result[outcome] += 1
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const col = await collection()
  const now = new Date()
  const hasMore = (await col.countDocuments({
    $or: [
      {
        $and: [
          pendingStateFilter(),
          { expiresAt: { $lte: now } },
        ],
      },
      { state: "deleting" },
    ],
  }, { limit: 1 })) > 0

  return { ...result, hasMore }
}

/**
 * Deletes comment Blobs no longer referenced after one comment was removed.
 * Call this only after the corresponding comment database write succeeds.
 */
export async function deleteCommentImagesFromContent(
  content: string
): Promise<CommentImageCleanupResult> {
  return deleteCommentImagesFromContents([content])
}

/**
 * Cascade helper for deleting a post/note and its comments. Pass the deleted
 * comments' raw Markdown after the database deletion has succeeded.
 */
export async function deleteCommentImagesFromContents(
  contents: Iterable<string>
): Promise<CommentImageCleanupResult> {
  const urls = extractCommentBlobUrls(contents)
  const result = { deleted: 0, preserved: 0, failed: 0 }
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < urls.length) {
      const index = nextIndex
      nextIndex += 1
      const url = urls[index]

      try {
        if (await isReferencedByComment(url)) {
          result.preserved += 1
          continue
        }

        await deleteImage(url)
        await (await collection()).deleteOne({ url })
        result.deleted += 1
      } catch {
        await queueCommentImageCleanup(url).catch(() => undefined)
        result.failed += 1
      }
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(MAX_CLEANUP_CONCURRENCY, urls.length) },
    () => worker()
  ))
  return result
}
