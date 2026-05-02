type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, opts: { limit: number; windowMs: number }): boolean {
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return true
  }

  if (current.count >= opts.limit) return false
  current.count += 1
  return true
}
