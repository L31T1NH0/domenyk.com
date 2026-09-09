import { MAX_RICH_CONTENT_LENGTH } from "./content-format.js"

export type PersonalUpdate = {
  _id: string
  content: string
  contentHtml: string
  createdAt: string
  updatedAt: string
}

export type PersonalTimelinePage = {
  items: PersonalUpdate[]
  nextCursor: string | null
}

export type PersonalUpdateOrderDirection = "up" | "down"

export function personalUpdateContent(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("content" in body)) return null
  if (typeof body.content !== "string") return null
  const content = body.content.trim()
  return content.length > 0 && content.length <= MAX_RICH_CONTENT_LENGTH ? content : null
}

export function personalUpdateOrderDirection(body: unknown): PersonalUpdateOrderDirection | null {
  if (!body || typeof body !== "object" || !("direction" in body)) return null
  return body.direction === "up" || body.direction === "down" ? body.direction : null
}
