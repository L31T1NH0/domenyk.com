import "server-only"

import { auth } from "@clerk/nextjs/server"
import { ObjectId } from "mongodb"
import type { Post, PostSummary, PostTranslation } from "@/lib/db/posts"
import type { Theme } from "@/lib/db/themes"
import { GoAdminError, goAdminOrigin, requestGoAdmin } from "./go-admin"
import { invalidatePublicContentCache } from "./public-content-cache"

export function usesGoAdmin() { return goAdminOrigin() !== null }

async function adminRequest<T>(path: string, method = "GET", body?: unknown) {
  const origin = goAdminOrigin()
  if (!origin) throw new GoAdminError(503)
  const session = await auth()
  if (!session.userId) throw new GoAdminError(401)
  if (!process.env.ADMIN_USER_ID || session.userId !== process.env.ADMIN_USER_ID) throw new GoAdminError(403)
  const token = await session.getToken()
  if (!token) throw new GoAdminError(401)
  return requestGoAdmin<T>(origin, token, path, method, body)
}

function date(value: unknown, fallback?: Date) {
  if (value === undefined || value === null) { if (fallback) return fallback; throw new GoAdminError(503) }
  if (typeof value !== "string") throw new GoAdminError(503)
  const result = new Date(value)
  if (!Number.isFinite(result.getTime())) throw new GoAdminError(503)
  return result
}
function id(value: unknown) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) throw new GoAdminError(503)
  return new ObjectId(value)
}
function hydratePost(value: Record<string, unknown>): Post {
  if (!value || typeof value.title !== "string" || typeof value.slug !== "string") throw new GoAdminError(503)
  const createdAt = date(value.createdAt)
  const updatedAt = date(value.updatedAt, createdAt)
  const originalContentUpdatedAt = date(value.originalContentUpdatedAt, updatedAt)
  const translations: Post["translations"] = {}
  for (const locale of ["en", "de", "id"] as const) {
    const raw = (value.translations as Record<string, Record<string, unknown>> | undefined)?.[locale]
    if (!raw) continue
    translations[locale] = {
      ...raw,
      sourceUpdatedAt: date(raw.sourceUpdatedAt, originalContentUpdatedAt),
      createdAt: date(raw.createdAt, createdAt), updatedAt: date(raw.updatedAt, updatedAt),
      publishedAt: raw.publishedAt ? date(raw.publishedAt) : undefined,
    } as PostTranslation
  }
  return {
    ...value, _id: id(value._id), createdAt, updatedAt, originalContentUpdatedAt,
    publishedAt: value.publishedAt ? date(value.publishedAt) : undefined,
    tags: Array.isArray(value.tags) ? value.tags : [], translations,
    content: typeof value.content === "string" ? value.content : "",
    style: value.style || "standard", published: value.published === true, pinned: value.pinned === true,
  } as Post
}

export async function getGoAdminPosts(): Promise<PostSummary[]> {
  const posts: PostSummary[] = []
  // Preserve the current panel's 100-record limit while respecting Go's page size.
  for (let page = 1; page <= 2; page++) {
    const result = await adminRequest<{ items: Record<string, unknown>[]; total: number }>(`/v1/admin/posts?page=${page}&limit=50`)
    if (!Array.isArray(result.items) || !Number.isSafeInteger(result.total)) throw new GoAdminError(503)
    posts.push(...result.items.map(hydratePost))
    if (posts.length >= result.total) break
  }
  return posts
}
export async function getGoAdminPost(postID: string): Promise<Post | null> {
  if (!/^[a-f\d]{24}$/i.test(postID)) return null
  try { return hydratePost(await adminRequest<Record<string, unknown>>(`/v1/admin/posts/${postID}`)) }
  catch (error) { if (error instanceof GoAdminError && error.status === 404) return null; throw error }
}
export async function getGoAdminPostThemes(postID: string): Promise<Theme[]> {
  if (!/^[a-f\d]{24}$/i.test(postID)) throw new GoAdminError(400)
  const result = await adminRequest<{ items: Record<string, unknown>[] }>(`/v1/admin/posts/${postID}/themes`)
  if (!Array.isArray(result.items)) throw new GoAdminError(503)
  return result.items.map(theme => ({
    ...theme, _id: id(theme._id), postIds: Array.isArray(theme.postIds) ? theme.postIds.map(id) : [],
    createdAt: date(theme.createdAt, new Date(0)), updatedAt: date(theme.updatedAt, new Date(0)),
  } as Theme))
}

export async function writeGoAdminPost(method: "POST" | "PATCH" | "DELETE", postID?: string, input?: unknown) {
  if (postID && !/^[a-f\d]{24}$/i.test(postID)) throw new GoAdminError(400)
  let path = "/v1/admin/posts" + (postID ? `/${postID}` : "")
  let body: Record<string, unknown> | undefined
  let locale = "pt"
  if (method !== "DELETE") {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new GoAdminError(400)
    body = { ...input } as Record<string, unknown>
    if ("locale" in body) {
      if (typeof body.locale !== "string" || !["pt", "en", "de", "id"].includes(body.locale)) throw new GoAdminError(400)
      locale = body.locale
    }
    delete body.locale
    if (locale === "pt") delete body.coverAlt
    else {
      if (method !== "PATCH" || !postID) throw new GoAdminError(400)
      path += `/translations/${locale}`
    }
  }
  const result = await adminRequest<Record<string, unknown>>(path, method, body)
  invalidatePublicContentCache()
  if (method === "DELETE") return { ok: true }
  if (locale !== "pt") return { ok: true, locale, translation: result }
  return { ...result, ok: true, locale }
}

export function goAdminErrorResponse(error: unknown): Response {
  if (!(error instanceof GoAdminError)) throw error
  return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } })
}
