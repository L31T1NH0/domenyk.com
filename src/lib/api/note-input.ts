import { createNote, normalizeNoteContent, serializeNote } from "@/lib/db/notes"
import { asString, asTrustedImageUrlArray, toObjectId } from "@/lib/validation"

export class NoteInputError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

export type NoteInputBody = {
  title?: unknown
  content?: unknown
  images?: unknown
  continueFromNoteId?: unknown
}

export async function createSerializedNoteFromBody(body: NoteInputBody | null) {
  const title = asString(body?.title, 120)?.trim() || undefined
  const content = asString(body?.content, 20_000) ?? ""
  const normalizedContent = normalizeNoteContent(content)

  if (!normalizedContent) {
    throw new NoteInputError("content é obrigatório")
  }

  const images = asTrustedImageUrlArray(body?.images, 6)
  const continueFromNoteId = body?.continueFromNoteId === undefined
    ? undefined
    : asString(body.continueFromNoteId, 24)
  if (body?.continueFromNoteId !== undefined && (!continueFromNoteId || !toObjectId(continueFromNoteId))) {
    throw new NoteInputError("Nota de origem inválida.")
  }

  const note = await createNote({
    title,
    content: normalizedContent,
    images,
    continueFromNoteId,
  })
  return serializeNote(note)
}
