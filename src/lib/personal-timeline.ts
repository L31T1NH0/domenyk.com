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

export function personalUpdateContent(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("content" in body)) return null
  if (typeof body.content !== "string") return null
  const content = body.content.trim()
  return content.length > 0 && content.length <= MAX_RICH_CONTENT_LENGTH ? content : null
}
