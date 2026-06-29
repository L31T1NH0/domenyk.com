import { normalizeNoteContent } from "@/lib/db/notes"
import { asString } from "@/lib/validation"

export const MAX_COMMENT_CONTENT_LENGTH = 20_000

export function parseCommentContent(value: unknown): string | null {
  const content = asString(value, MAX_COMMENT_CONTENT_LENGTH) ?? ""
  const normalized = normalizeNoteContent(content)
  return normalized || null
}
