import { createNote, normalizeNoteContent, serializeNote } from "@/lib/db/notes"
import { asString, asTrustedImageUrlArray } from "@/lib/validation"

export async function createSerializedNoteFromBody(body: { title?: unknown; content?: unknown; images?: unknown } | null) {
  const title = asString(body?.title, 120)?.trim() || undefined
  const content = asString(body?.content, 20_000) ?? ""
  const normalizedContent = normalizeNoteContent(content)

  if (!normalizedContent) {
    throw new Error("content é obrigatório")
  }

  const images = asTrustedImageUrlArray(body?.images, 6)
  const note = await createNote({ title, content: normalizedContent, images })
  return serializeNote(note)
}
