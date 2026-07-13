import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { renderMarkdownSync } from "../mdx"
import { isNoteIndexable, noteDisplayTitle } from "../seo"
import { toObjectId } from "../validation"

export type Note = {
  _id: ObjectId
  title?: string
  seoTitle?: string
  seoDescription?: string
  content: string
  images?: string[]
  publishedAt: Date
  createdAt: Date
  updatedAt?: Date
  deleting?: boolean
}
export type SerializedNote = Omit<Note, "_id" | "deleting" | "publishedAt" | "createdAt" | "updatedAt"> & {
  _id: string
  publishedAt: string
  createdAt: string
  updatedAt: string
  contentHtml: string
  indexable: boolean
}

const indexableNoteFilter = {
  deleting: { $ne: true },
  seoTitle: { $type: "string", $regex: /\S/ },
  seoDescription: { $type: "string", $regex: /\S/ },
} as const

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
    _id: note._id.toString(),
    title: note.title,
    seoTitle: note.seoTitle,
    seoDescription: note.seoDescription,
    content,
    images: note.images,
    publishedAt: note.publishedAt.toISOString(),
    createdAt: note.createdAt.toISOString(),
    updatedAt: (note.updatedAt ?? note.createdAt).toISOString(),
    contentHtml: renderMarkdownSync(content, {
      defaultImageAlt: `Imagem relacionada a “${noteDisplayTitle({ title: note.title, content })}”`,
    }),
    indexable: isNoteIndexable(note),
  }
}

let indexesPromise: Promise<void> | undefined

async function collection() {
  const col = (await getDb()).collection<Note>("notes")
  indexesPromise ??= col.createIndex({ content: "text" }).then(() => undefined)
  await indexesPromise
  return col
}
export async function getNotes(opts: { cursor?: string; page?: number; limit?: number; search?: string } = {}): Promise<{ notes: Note[]; nextCursor: string | null; total: number }> {
  const { cursor, page = 1, limit = 20, search } = opts
  const baseFilter: Record<string, unknown> = { deleting: { $ne: true } }
  if (search?.trim()) baseFilter.$text = { $search: search.trim() }
  const filter: Record<string, unknown> = { ...baseFilter }
  if (cursor) {
    const cursorId = toObjectId(cursor)
    if (!cursorId) return { notes: [], nextCursor: null, total: 0 }
    filter._id = { $lt: cursorId }
  }
  const col = await collection()
  const [notes, total] = await Promise.all([
    col.find(filter)
      .sort({ _id: -1 })
      .skip(cursor ? 0 : Math.max(0, page - 1) * limit)
      .limit(limit + 1)
      .toArray(),
    col.countDocuments(baseFilter),
  ])
  const hasMore = notes.length > limit
  if (hasMore) notes.pop()
  return { notes, nextCursor: hasMore ? notes[notes.length - 1]._id.toString() : null, total }
}

export async function countNotes(search?: string): Promise<number> {
  const filter: Record<string, unknown> = { deleting: { $ne: true } }
  if (search?.trim()) filter.$text = { $search: search.trim() }
  return (await collection()).countDocuments(filter)
}

export async function getIndexableNotes(opts: { page?: number; limit?: number } = {}): Promise<Note[]> {
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.max(1, opts.limit ?? 20)
  return (await collection())
    .find(indexableNoteFilter)
    .sort({ _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray()
}

export async function countIndexableNotes(): Promise<number> {
  return (await collection()).countDocuments(indexableNoteFilter)
}

export async function getNote(id: string): Promise<Note | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return (await collection()).findOne({ _id: objectId, deleting: { $ne: true } })
}

export async function createNote(data: { title?: string; seoTitle?: string; seoDescription?: string; content: string; images?: string[] }): Promise<Note> {
  const col = await collection()
  const now = new Date()
  const note: Omit<Note, "_id"> = {
    ...(data.title ? { title: data.title } : {}),
    ...(data.seoTitle ? { seoTitle: data.seoTitle } : {}),
    ...(data.seoDescription ? { seoDescription: data.seoDescription } : {}),
    content: normalizeNoteContent(data.content), images: data.images, publishedAt: now, createdAt: now, updatedAt: now,
  }
  const result = await col.insertOne(note as Note)
  return { ...note, _id: result.insertedId }
}

export async function updateNote(id: string, data: { title?: string | null; seoTitle?: string | null; seoDescription?: string | null; content: string; images?: string[] }): Promise<Note | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null

  const update: Partial<Note> = { content: normalizeNoteContent(data.content), updatedAt: new Date() }
  if (data.title) update.title = data.title
  if (data.seoTitle) update.seoTitle = data.seoTitle
  if (data.seoDescription) update.seoDescription = data.seoDescription
  if (data.images !== undefined) update.images = data.images

  const $unset: Record<string, ""> = {}
  if (data.title === null) $unset.title = ""
  if (data.seoTitle === null) $unset.seoTitle = ""
  if (data.seoDescription === null) $unset.seoDescription = ""

  return (await collection()).findOneAndUpdate(
    { _id: objectId },
    Object.keys($unset).length > 0 ? { $set: update, $unset } : { $set: update },
    { returnDocument: "after" }
  )
}

export async function deleteNote(id: string): Promise<boolean> {
  const objectId = toObjectId(id)
  if (!objectId) return false
  const result = await (await collection()).deleteOne({ _id: objectId })
  return result.deletedCount === 1
}

export async function markNoteDeleting(id: string): Promise<boolean> {
  const objectId = toObjectId(id)
  if (!objectId) return false
  const result = await (await collection()).updateOne(
    { _id: objectId },
    { $set: { deleting: true, updatedAt: new Date() } }
  )
  return result.matchedCount === 1
}
