import { revalidatePath, revalidateTag } from "next/cache"
import { backendRevalidationPaths, isBackendRevalidationAuthorized } from "@/lib/backend-revalidation"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.NEXT_REVALIDATE_SECRET
  if (!secret || secret.length < 32) return Response.json({ error: "Not configured" }, { status: 503 })
  if (!isBackendRevalidationAuthorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const reader = request.body?.getReader()
  if (!reader) return Response.json({ error: "Invalid body" }, { status: 400 })
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 16_384) {
        await reader.cancel()
        return Response.json({ error: "Body too large" }, { status: 413 })
      }
      chunks.push(value)
    }
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  } finally {
    reader.releaseLock()
  }
  let value: unknown
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const paths = backendRevalidationPaths(value)
  if (!paths) return Response.json({ error: "Invalid paths" }, { status: 400 })
  invalidatePublicContentCache()
  revalidateTag("notification-settings", { expire: 0 })
  for (const path of paths) revalidatePath(path)
  return Response.json({ revalidated: true }, { headers: { "Cache-Control": "no-store" } })
}
