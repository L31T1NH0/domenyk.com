import "server-only"

import { getNote } from "./db/notes"
import { descriptionFromMarkdown } from "./seo"
import { auth } from "@clerk/nextjs/server"
import { cache } from "react"
import { GoAdminError, goAdminOrigin, goAPIHeaders, requestGoAdmin } from "./go-admin"
import { isSafeLinkURL, parseLinkInput, type SiteLink } from "./links"
import { parseLinkPageSettings, type LinkContent, type LinkPageData } from "./link-page"

export async function requestAdminLinks<T>(method = "GET", id?: string, body?: unknown, page?: number): Promise<T> {
  const path = "/v1/admin/links" + (id ? `/${id}` : "") + (page ? `?page=${page}&limit=50` : "")
  if (id && !/^[a-f\d]{24}$/i.test(id)) throw new GoAdminError(400)
  return requestLinksAction<T>(path, method, body)
}

async function linkAdminSession() {
  const origin = goAdminOrigin()
  if (!origin) throw new GoAdminError(503)
  const session = await auth()
  if (!session.userId) throw new GoAdminError(401)
  if (!process.env.ADMIN_USER_ID || session.userId !== process.env.ADMIN_USER_ID) throw new GoAdminError(403)
  const token = await session.getToken()
  if (!token) throw new GoAdminError(401)
  return { origin, token }
}
export async function requestLinksAction<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const { origin, token } = await linkAdminSession()
  return requestGoAdmin<T>(origin, token, path, method, body)
}

export async function requestLinkMedia(method: "GET" | "POST", body?: ArrayBuffer, contentType?: string, cursor?: string) {
  const { origin, token } = await linkAdminSession()
  const url = new URL("/v1/admin/media", origin)
  if (cursor) url.searchParams.set("cursor", cursor)
  const response = await fetch(url, { method, body, headers: { ...goAPIHeaders(), Accept: "application/json", Authorization: `Bearer ${token}`, ...(contentType ? { "Content-Type": contentType } : {}) }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new GoAdminError(response.status)
  if (!response.headers.get("content-type")?.includes("application/json")) throw new GoAdminError(503)
  return response.json()
}

export async function publicLinkRequest(path: string, body?: unknown) {
  const origin = goAdminOrigin(process.env.GO_ADMIN_API_URL?.trim() || process.env.CONTENT_API_URL)
  if (!origin) throw new GoAdminError(503)
  const response = await fetch(new URL(path, origin), {
    headers: { ...goAPIHeaders(), Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    ...(body !== undefined ? { method: "POST", body: JSON.stringify(body) } : {}),
  })
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new GoAdminError(503)
  return response.json()
}

export async function getLinks(admin = false): Promise<SiteLink[]> {
  const links: SiteLink[] = []
  for (let page = 1; page <= 500; page++) {
    const data = admin
      ? await requestAdminLinks<{ items: unknown[]; total: number; page: number; limit: number }>("GET", undefined, undefined, page)
      : await publicLinkRequest(`/v1/links?page=${page}&limit=50`)
    if (!data || !Array.isArray(data.items) || data.items.length > 50 || !Number.isSafeInteger(data.total) || data.total < 0 || data.page !== page || data.limit !== 50) throw new GoAdminError(503)
    for (const raw of data.items) {
      if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !/^[a-f\d]{24}$/i.test(raw.id)) throw new GoAdminError(503)
      try {
        const input = parseLinkInput(admin ? raw : { ...raw, published: true })
        links.push({ ...input, id: raw.id, ...(admin ? { health: typeof raw.health === "string" ? raw.health : undefined, checkedAt: typeof raw.checkedAt === "string" ? raw.checkedAt : undefined } : {}) })
      } catch { throw new GoAdminError(503) }
    }
    if (links.length >= data.total) return links
    if (!data.items.length) throw new GoAdminError(503)
  }
  throw new GoAdminError(503)
}

export async function getLatestGoNote() {
  const data = await publicLinkRequest("/v1/notes?page=1&limit=1")
  if (!data || !Array.isArray(data.items) || data.items.length > 1) throw new GoAdminError(503)
  if (!data.items.length) return { notes: [] }
  const note = data.items[0]
  if (!note || typeof note.id !== "string" || !/^[a-f\d]{24}$/i.test(note.id) || typeof note.content !== "string" || typeof note.publishedAt !== "string" || !Number.isFinite(Date.parse(note.publishedAt))) throw new GoAdminError(503)
  return { notes: [{ _id: note.id, content: note.content, publishedAt: note.publishedAt }] }
}

export function parseLinkContent(value: unknown): LinkContent {
  if (!value || typeof value !== "object") throw new GoAdminError(503)
  const item = value as Record<string, unknown>
  if (!["post", "note", "link"].includes(item.kind as string) || typeof item.id !== "string" || !/^[a-f\d]{24}$/i.test(item.id) ||
    !["title", "description", "url", "cover", "coverAlt", "publishedAt"].every(key => typeof item[key] === "string")) throw new GoAdminError(503)
  const result = item as unknown as LinkContent
  if (!isSafeLinkURL(result.url) || (result.cover && !isSafeLinkURL(result.cover)) || !Number.isFinite(Date.parse(result.publishedAt))) throw new GoAdminError(503)
  return { kind: result.kind, id: result.id, title: result.title, description: result.description, url: result.url, cover: result.cover, coverAlt: result.coverAlt, publishedAt: result.publishedAt }
}

const noteCardContent = cache(async (id: string) => {
  const note = await getNote(id)
  return note ? descriptionFromMarkdown(note.content, 1000) : ""
})

export async function getLinkContents(values: unknown[]): Promise<LinkContent[]> {
  return Promise.all(values.map(async value => {
    const item = parseLinkContent(value)
    return item.kind === "note" ? { ...item, content: await noteCardContent(item.id) } : item
  }))
}

export const getLinkPage = cache(async (): Promise<LinkPageData> => {
  const data = await publicLinkRequest("/v1/links/page")
  if (!data || !Array.isArray(data.featured) || data.featured.length > 3 || !Array.isArray(data.readings) || data.readings.length > 20) throw new GoAdminError(503)
  const [featured, readings] = await Promise.all([getLinkContents(data.featured), getLinkContents(data.readings)])
  return { settings: data.settings === null ? null : parseLinkPageSettings(data.settings), featured, readings }
})

export function linkActionError(error: unknown): Response {
  return Response.json({ error: error instanceof GoAdminError ? error.message : "Não foi possível concluir esta operação." }, { status: error instanceof GoAdminError ? error.status : 503, headers: { "Cache-Control": "private, no-store" } })
}
