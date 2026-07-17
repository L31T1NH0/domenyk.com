import { normalizeNoteContent } from "@/lib/db/notes"
import { asString } from "@/lib/validation"
import { isProjectBlobHostname } from "@/lib/blob-host"

const MAX_COMMENT_CONTENT_LENGTH = 5_000
export const MAX_COMMENT_IMAGES = 4

const COMMENT_IMAGE_PATTERN = /!\[[^\]]*\]\(\s*([^\s)]+)[^)]*\)|<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi

function hasOnlyAllowedCommentImages(content: string, allowImages: boolean): boolean {
  let count = 0
  let match: RegExpExecArray | null
  const matcher = new RegExp(COMMENT_IMAGE_PATTERN.source, COMMENT_IMAGE_PATTERN.flags)

  while ((match = matcher.exec(content)) !== null) {
    if (!allowImages) return false
    count += 1
    if (count > MAX_COMMENT_IMAGES) return false
    const source = match[1] ?? match[2] ?? match[3] ?? match[4] ?? ""
    try {
      const url = new URL(source)
      if (
        url.protocol !== "https:" ||
        !isProjectBlobHostname(url.hostname) ||
        !url.pathname.startsWith("/comments/")
      ) {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}

export function parseCommentContent(
  value: unknown,
  { allowImages = false }: { allowImages?: boolean } = {}
): string | null {
  const content = asString(value, MAX_COMMENT_CONTENT_LENGTH) ?? ""
  const normalized = normalizeNoteContent(content)
  return normalized && hasOnlyAllowedCommentImages(normalized, allowImages) ? normalized : null
}
