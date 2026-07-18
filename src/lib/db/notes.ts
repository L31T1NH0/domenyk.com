import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { renderMarkdownSync } from "../mdx"
import { isNoteIndexable, noteDisplayTitle } from "../seo"
import { toObjectId } from "../validation"
import { deleteNoteMetrics } from "./note-metrics"
import { estimateNoteReading, type NoteReadingEstimate } from "../note-reading"
import { serializeNoteThread, type SerializedNoteThread } from "../note-thread"

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
  threadRootId?: ObjectId
  previousNoteId?: ObjectId
  threadPosition?: number
}
export type SerializedNote = Omit<Note, "_id" | "deleting" | "publishedAt" | "createdAt" | "updatedAt" | "threadRootId" | "previousNoteId" | "threadPosition"> & {
  _id: string
  publishedAt: string
  createdAt: string
  updatedAt: string
  contentHtml: string
  indexable: boolean
  readingEstimate: NoteReadingEstimate
  thread?: SerializedNoteThread
}

export class NoteThreadError extends Error {}

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
  const thread = serializeNoteThread(note)
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
    readingEstimate: estimateNoteReading(content, note.images?.length ?? 0),
    ...(thread ? { thread } : {}),
  }
}

let indexesPromise: Promise<void> | undefined

async function collection() {
  const col = (await getDb()).collection<Note>("notes")
  indexesPromise ??= Promise.all([
    col.createIndex({ content: "text" }),
    col.createIndex(
      { threadRootId: 1, threadPosition: 1 },
      { unique: true, sparse: true }
    ),
    col.createIndex({ previousNoteId: 1 }, { unique: true, sparse: true }),
  ]).then(() => undefined)
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

export async function getNoteThread(note: Note): Promise<Note[]> {
  if (!note.threadRootId) return [note]
  return (await collection())
    .find({ threadRootId: note.threadRootId, deleting: { $ne: true } })
    .sort({ threadPosition: 1, _id: 1 })
    .toArray()
}

export async function createNote(data: { title?: string; seoTitle?: string; seoDescription?: string; content: string; images?: string[]; continueFromNoteId?: string }): Promise<Note> {
  const col = await collection()
  const now = new Date()
  let threadFields: Pick<Note, "threadRootId" | "previousNoteId" | "threadPosition"> = {}
  let initializedRoot: ObjectId | null = null

  if (data.continueFromNoteId) {
    const sourceId = toObjectId(data.continueFromNoteId)
    if (!sourceId) throw new NoteThreadError("Nota de origem inválida.")

    const source = await col.findOne({ _id: sourceId, deleting: { $ne: true } })
    if (!source) throw new NoteThreadError("A nota usada para continuar a thread não existe.")

    if (source.threadRootId) {
      const lastNote = await col.find({
        threadRootId: source.threadRootId,
        deleting: { $ne: true },
      }).sort({ threadPosition: -1, _id: -1 }).limit(1).next()
      if (!lastNote?.threadPosition) throw new NoteThreadError("A thread está inconsistente.")
      threadFields = {
        threadRootId: source.threadRootId,
        previousNoteId: lastNote._id,
        threadPosition: lastNote.threadPosition + 1,
      }
    } else {
      const initialized = await col.updateOne(
        { _id: source._id, deleting: { $ne: true }, threadRootId: { $exists: false } },
        { $set: { threadRootId: source._id, threadPosition: 1, updatedAt: now } }
      )
      if (initialized.matchedCount !== 1) {
        throw new NoteThreadError("A thread mudou enquanto a nota era criada. Tente novamente.")
      }
      initializedRoot = source._id
      threadFields = {
        threadRootId: source._id,
        previousNoteId: source._id,
        threadPosition: 2,
      }
    }
  }

  const note: Omit<Note, "_id"> = {
    ...(data.title ? { title: data.title } : {}),
    ...(data.seoTitle ? { seoTitle: data.seoTitle } : {}),
    ...(data.seoDescription ? { seoDescription: data.seoDescription } : {}),
    content: normalizeNoteContent(data.content), images: data.images, publishedAt: now, createdAt: now, updatedAt: now,
    ...threadFields,
  }
  try {
    const result = await col.insertOne(note as Note)
    return { ...note, _id: result.insertedId }
  } catch (error) {
    if (initializedRoot) {
      const members = await col.countDocuments({ threadRootId: initializedRoot })
      if (members === 1) {
        await col.updateOne(
          { _id: initializedRoot },
          { $unset: { threadRootId: "", threadPosition: "" } }
        )
      }
    }
    throw error
  }
}

export async function linkNoteToThread(sourceNoteId: string, targetNoteId: string): Promise<Note[]> {
  const sourceId = toObjectId(sourceNoteId)
  const targetId = toObjectId(targetNoteId)
  if (!sourceId || !targetId) throw new NoteThreadError("Nota inválida.")
  if (sourceId.equals(targetId)) throw new NoteThreadError("Escolha outra nota para completar a thread.")

  const col = await collection()
  const [source, target] = await Promise.all([
    col.findOne({ _id: sourceId, deleting: { $ne: true } }),
    col.findOne({ _id: targetId, deleting: { $ne: true } }),
  ])
  if (!source) throw new NoteThreadError("A thread selecionada não existe mais.")
  if (!target) throw new NoteThreadError("A nota que seria vinculada não existe mais.")

  const selectedRootId = source.threadRootId ?? source._id
  if (target.threadRootId) {
    if (source.threadRootId && target.threadRootId.equals(source.threadRootId)) {
      return col.find({
        threadRootId: source.threadRootId,
        deleting: { $ne: true },
      }).sort({ threadPosition: 1, _id: 1 }).toArray()
    }
    throw new NoteThreadError("Essa nota já pertence a outra thread.")
  }

  const now = new Date()
  let initializedRoot = false
  let previousNoteId = source._id
  let threadPosition = 2

  if (source.threadRootId) {
    const lastNote = await col.find({
      threadRootId: source.threadRootId,
      deleting: { $ne: true },
    }).sort({ threadPosition: -1, _id: -1 }).limit(1).next()
    if (!lastNote?.threadPosition) throw new NoteThreadError("A thread está inconsistente.")
    previousNoteId = lastNote._id
    threadPosition = lastNote.threadPosition + 1
  } else {
    const initialized = await col.updateOne(
      { _id: source._id, deleting: { $ne: true }, threadRootId: { $exists: false } },
      { $set: { threadRootId: source._id, threadPosition: 1, updatedAt: now } }
    )
    if (initialized.matchedCount !== 1) {
      throw new NoteThreadError("A thread mudou enquanto as notas eram vinculadas. Tente novamente.")
    }
    initializedRoot = true
  }

  try {
    const linked = await col.updateOne(
      { _id: target._id, deleting: { $ne: true }, threadRootId: { $exists: false } },
      {
        $set: {
          threadRootId: selectedRootId,
          previousNoteId,
          threadPosition,
          updatedAt: now,
        },
      }
    )
    if (linked.matchedCount !== 1) {
      throw new NoteThreadError("A nota mudou enquanto era vinculada. Tente novamente.")
    }
  } catch (error) {
    if (initializedRoot) {
      const members = await col.countDocuments({ threadRootId: selectedRootId })
      if (members === 1) {
        await col.updateOne(
          { _id: selectedRootId },
          { $unset: { threadRootId: "", threadPosition: "" } }
        )
      }
    }
    throw error
  }

  return col.find({
    threadRootId: selectedRootId,
    deleting: { $ne: true },
  }).sort({ threadPosition: 1, _id: 1 }).toArray()
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

export async function deleteNote(id: string): Promise<{ deleted: boolean; thread: Note[] }> {
  const objectId = toObjectId(id)
  if (!objectId) return { deleted: false, thread: [] }
  const col = await collection()
  const note = await col.findOne({ _id: objectId })
  if (!note) return { deleted: false, thread: [] }
  const result = await col.deleteOne({ _id: objectId })
  let repairedThread: Note[] = []
  if (result.deletedCount === 1 && note.threadRootId) {
    const remaining = await col.find({
      threadRootId: note.threadRootId,
      deleting: { $ne: true },
    }).sort({ threadPosition: 1, _id: 1 }).toArray()

    if (remaining.length === 1) {
      await col.updateOne(
        { _id: remaining[0]._id },
        { $unset: { threadRootId: "", previousNoteId: "", threadPosition: "" } }
      )
      const standalone = await col.findOne({ _id: remaining[0]._id })
      if (standalone) repairedThread = [standalone]
    } else if (remaining.length > 1) {
      const nextRootId = remaining[0]._id
      await col.bulkWrite(remaining.map((member, index) => ({
        updateOne: {
          filter: { _id: member._id },
          update: index === 0
            ? {
                $set: { threadRootId: nextRootId, threadPosition: 1 },
                $unset: { previousNoteId: "" },
              }
            : {
                $set: {
                  threadRootId: nextRootId,
                  previousNoteId: remaining[index - 1]._id,
                  threadPosition: index + 1,
                },
              },
        },
      })))
      repairedThread = await col.find({
        threadRootId: nextRootId,
        deleting: { $ne: true },
      }).sort({ threadPosition: 1, _id: 1 }).toArray()
    }
  }
  if (result.deletedCount === 1) await deleteNoteMetrics(id)
  return { deleted: result.deletedCount === 1, thread: repairedThread }
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
