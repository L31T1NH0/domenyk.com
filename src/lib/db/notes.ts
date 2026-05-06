import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { renderMarkdownSync } from "../mdx"
import { toObjectId } from "../validation"

export type Note = { _id: ObjectId; content: string; images?: string[]; publishedAt: Date; createdAt: Date }
export type SerializedNote = Omit<Note, "_id" | "publishedAt" | "createdAt"> & {
  _id: string; publishedAt: string; createdAt: string; contentHtml: string
}

function protectImages(content: string): { protected: string; images: string[] } {
  const images: string[] = []
  let counter = 0
  const protected_ = content.replace(
    /!\[([^\]]*)\]\(([^)]*)\)/g,
    (match) => {
      images.push(match)
      return `__IMG_${counter++}__`
    }
  )
  return { protected: protected_, images }
}

function restoreImages(content: string, images: string[]): string {
  let result = content
  images.forEach((img, i) => { result = result.replace(`__IMG_${i}__`, img) })
  return result
}

function shouldPreserveLineBreaks(block: string): boolean {
  const lines = block.split("\n")
  return lines.some(
    (line) =>
      /^(```|~~~)/.test(line) ||
      /^\s*([-*+]|\d+\.)\s+/.test(line) ||
      /^\s*>/.test(line) ||
      /^\s*#{1,6}\s+/.test(line) ||
      /^\s*\|.*\|\s*$/.test(line)
  )
}

export function normalizeNoteContent(content: string): string {
  const { protected: protected_, images } = protectImages(content)
  const result = protected_
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => {
      const nb = block.split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
      if (shouldPreserveLineBreaks(nb)) return nb
      return nb.replace(/\s*\n\s*/g, " ").replace(/[ \t]{2,}/g, " ")
    })
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return restoreImages(result, images)
}

export function serializeNote(note: Note): SerializedNote {
  const content = normalizeNoteContent(note.content)
  return {
    ...note, content, _id: note._id.toString(),
    publishedAt: note.publishedAt.toISOString(), createdAt: note.createdAt.toISOString(),
    contentHtml: renderMarkdownSync(content),
  }
}

let indexesPromise: Promise<void> | undefined

async function collection() {
  const col = (await getDb()).collection<Note>("notes")
  indexesPromise ??= col.createIndex({ _id: 1 }).then(() => undefined)
  await indexesPromise
  return col
}
export async function getNotes(opts: { cursor?: string; limit?: number } = {}): Promise<{ notes: Note[]; nextCursor: string | null }> {
  const { cursor, limit = 20 } = opts
  const filter: Record<string, unknown> = {}
  if (cursor) {
    const cursorId = toObjectId(cursor)
    if (!cursorId) return { notes: [], nextCursor: null }
    filter._id = { $lt: cursorId }
  }
  const notes = await (await collection()).find(filter).sort({ _id: -1 }).limit(limit + 1).toArray()
  const hasMore = notes.length > limit
  if (hasMore) notes.pop()
  return { notes, nextCursor: hasMore ? notes[notes.length - 1]._id.toString() : null }
}

export async function getNote(id: string): Promise<Note | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return (await collection()).findOne({ _id: objectId })
}

export async function createNote(data: { content: string; images?: string[] }): Promise<Note> {
  const col = await collection()
  const now = new Date()
  const note: Omit<Note, "_id"> = {
    content: normalizeNoteContent(data.content), images: data.images, publishedAt: now, createdAt: now,
  }
  const result = await col.insertOne(note as Note)
  return { ...note, _id: result.insertedId }
}

export async function updateNote(id: string, data: { content: string; images?: string[] }): Promise<Note | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null

  const update: Partial<Note> = { content: normalizeNoteContent(data.content) }
  if (data.images !== undefined) update.images = data.images

  return (await collection()).findOneAndUpdate(
    { _id: objectId },
    { $set: update },
    { returnDocument: "after" }
  )
}

export async function deleteNote(id: string): Promise<void> {
  const objectId = toObjectId(id)
  if (!objectId) return
  await (await collection()).deleteOne({ _id: objectId })
}
