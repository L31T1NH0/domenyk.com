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
    if (!(typeof error === "object" && error && "code" in error && error.code === 11000)) throw error
    bucket = await col.findOneAndUpdate(
      { _id: bucketId },
      { $inc: { count: 1 } },
      { returnDocument: "after" }
    )
  }

  return Boolean(bucket && bucket.count <= opts.limit)
}
