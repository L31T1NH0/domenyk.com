import { adminOnly } from "@/lib/auth"
import { isSafeLinkURL } from "@/lib/links"
import { linkActionError, requestLinkMedia } from "@/lib/links-api"

export async function GET(request: Request) {
  const denied = await adminOnly(); if (denied) return denied
  const cursor = new URL(request.url).searchParams.get("cursor") || undefined
  if (cursor && cursor.length > 2048) return Response.json({ error: "Página inválida." }, { status: 400 })
  try {
    const data = await requestLinkMedia("GET", undefined, undefined, cursor)
    if (!Array.isArray(data.blobs) || data.blobs.length > 100) throw new Error("Biblioteca inválida")
    const items = data.blobs.map((item: { url?: unknown }) => {
      if (typeof item.url !== "string" || !isSafeLinkURL(item.url)) throw new Error("Imagem inválida")
      return { url: item.url }
    })
    return Response.json({ items, cursor: data.hasMore && typeof data.cursor === "string" ? data.cursor : null }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return linkActionError(error) }
}
export async function POST(request: Request) {
  const denied = await adminOnly(); if (denied) return denied
  const type = request.headers.get("content-type")?.split(";")[0]
  if (!type || !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(type)) return Response.json({ error: "Envie PNG, JPG, WebP ou SVG." }, { status: 400 })
  const reader = request.body?.getReader()
  if (!reader) return Response.json({ error: "Imagem vazia." }, { status: 400 })
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      size += value.byteLength
      if (size > 4 * 1024 * 1024) { await reader.cancel(); return Response.json({ error: "A imagem deve ter no máximo 4 MB." }, { status: 413 }) }
      chunks.push(value)
    }
    const body = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
    const result = await requestLinkMedia("POST", body.buffer, type)
    return Response.json(result, { status: 201 })
  } catch (error) { return linkActionError(error) }
  finally { reader.releaseLock() }
}
