import "server-only"

import { getDb } from "@/lib/db/client"

type RateLimitBucket = {
  _id: string
  count: number
  expiresAt: Date
}

let indexesPromise: Promise<void> | undefined

async function collection() {
  const db = await getDb()
  const col = db.collection<RateLimitBucket>("rate_limits")
  indexesPromise ??= col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).then(() => undefined)
  await indexesPromise
  return col
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): Promise<boolean> {
  const now = Date.now()
  const windowStart = Math.floor(now / opts.windowMs) * opts.windowMs
  const bucketId = `${key}:${windowStart}`
  const expiresAt = new Date(windowStart + opts.windowMs * 2)
  const col = await collection()
  let bucket: RateLimitBucket | null
  try {
    bucket = await col.findOneAndUpdate(
      { _id: bucketId },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt },
      },
      { upsert: true, returnDocument: "after" }
    )
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
    bucket = await col.findOneAndUpdate(
      { _id: bucketId },
      { $inc: { count: 1 } },
      { returnDocument: "after" }
    )
  }

  return Boolean(bucket && bucket.count <= opts.limit)
}

/**
 * Atomically claims a rolling window for a key. Unlike rateLimit, the window
 * starts at the accepted request instead of at a fixed clock boundary.
 */
export async function claimOncePerWindow(key: string, windowMs: number): Promise<boolean> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + windowMs)

  try {
    const result = await (await collection()).updateOne(
      { _id: key, expiresAt: { $lte: now } },
      { $set: { count: 1, expiresAt } },
      { upsert: true }
    )
    return result.upsertedCount === 1 || result.modifiedCount === 1
  } catch (error) {
    // An unexpired document does not match the filter. Its attempted upsert
    // collides with the existing _id, which means another visit owns the window.
    if (isDuplicateKeyError(error)) return false
    throw error
  }
}
