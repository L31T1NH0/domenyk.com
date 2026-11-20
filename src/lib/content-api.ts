import "server-only"
import { goAPIHeaders } from "./go-admin.ts"

type Page<T> = { items: T[]; total: number; page: number; limit: number }
type MuralItem = { id: string; content: string; createdAt: string; updatedAt: string }
type WritingItem = { id: string; title: string; progress: number }

function configuredURL(path: string): URL | null {
  const base = process.env.CONTENT_API_URL?.trim()
  if (!base) return null
  const url = new URL(base)
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local && process.env.NODE_ENV !== "production")) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("CONTENT_API_URL must be the HTTPS origin of the Go API")
  }
  return new URL(path, url)
}

async function readPage<T>(url: URL, valid: (item: Record<string, unknown>) => boolean): Promise<Page<T> & { nextCursor?: string | null }> {
  const response = await fetch(url, {
    headers: { ...goAPIHeaders(), Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Content API request failed (${response.status})`)
  }
  const data = await response.json()
  if (!data || !Array.isArray(data.items) || data.items.length > 50 ||
      !Number.isSafeInteger(data.total) || data.total < 0 ||
      !Number.isSafeInteger(data.page) || data.page < 1 ||
      !Number.isSafeInteger(data.limit) || data.limit < 1 || data.limit > 50 ||
      !data.items.every((item: unknown) => !!item && typeof item === "object" && valid(item as Record<string, unknown>))) {
    throw new Error("Invalid Content API response")
  }
  return data
}

function validID(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value)
}

export async function getAPIMural(cursor?: string): Promise<(Page<MuralItem> & { nextCursor: string | null }) | null> {
  const url = configuredURL("/v1/mural")
  if (!url) return null
  if (cursor && !validID(cursor)) throw new Error("Invalid mural cursor")
  url.searchParams.set("limit", "20")
  if (cursor) url.searchParams.set("cursor", cursor)
  const data = await readPage<MuralItem>(url, item => validID(item.id) &&
    typeof item.content === "string" &&
    typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === "string" && Number.isFinite(Date.parse(item.updatedAt)))
  if (data.nextCursor !== null && !validID(data.nextCursor)) throw new Error("Invalid mural cursor response")
  return { ...data, nextCursor: data.nextCursor ?? null }
}

export async function getAPIWritingProgress(): Promise<WritingItem[] | null> {
  const url = configuredURL("/v1/writing")
  if (!url) return null
  url.searchParams.set("limit", "50")
  const items: WritingItem[] = []
  for (let page = 1; page <= 500; page++) {
    url.searchParams.set("page", String(page))
    const data = await readPage<WritingItem>(url, item => validID(item.id) &&
      typeof item.title === "string" && typeof item.progress === "number" &&
      Number.isFinite(item.progress) && item.progress >= 0 && item.progress <= 100)
    if (data.page !== page || data.limit !== 50 || (!data.items.length && items.length < data.total)) {
      throw new Error("Invalid writing pagination response")
    }
    items.push(...data.items.map(item => ({ id: item.id, title: item.title, progress: item.progress })))
    if (items.length >= data.total) return items
  }
  throw new Error("Writing pagination limit exceeded")
}
