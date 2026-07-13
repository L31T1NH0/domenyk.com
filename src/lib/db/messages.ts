import "server-only"

import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { toObjectId } from "../validation"
import type { MessageCategory } from "../message-categories"

export type MessageEntry = {
  _id: ObjectId
  authorId: string
  authorName: string
  body: string
  createdAt: Date
  readAt?: Date
}

export type MessageThread = {
  _id: ObjectId
  ownerId: string
  ownerName: string
  subject: string
  category: MessageCategory
  status: "open" | "answered" | "accepted" | "declined" | "closed"
  entries: MessageEntry[]
  createdAt: Date
  updatedAt: Date
  archivedAt?: Date
}

export const MAX_THREAD_ENTRIES = 100
export const MAX_OPEN_THREADS_PER_USER = 20
export const MESSAGE_PAGE_SIZE = 20

let indexesPromise: Promise<unknown> | undefined
async function collection() {
  const col = (await getDb()).collection<MessageThread>("message_threads")
  indexesPromise ??= Promise.all([
    col.createIndex({ ownerId: 1, updatedAt: -1 }),
    col.createIndex({ updatedAt: -1 }),
  ])
  await indexesPromise
  return col
}

export async function createMessageThread(data: { ownerId: string; ownerName: string; subject: string; body: string; category: MessageThread["category"] }) {
  const now = new Date()
  const thread: MessageThread = {
    _id: new ObjectId(), ownerId: data.ownerId, ownerName: data.ownerName,
    subject: data.subject, category: data.category, status: "open", createdAt: now, updatedAt: now,
    entries: [{ _id: new ObjectId(), authorId: data.ownerId, authorName: data.ownerName, body: data.body, createdAt: now }],
  }
  await (await collection()).insertOne(thread)
  return thread
}

function decodeCursor(cursor?: string) {
  if (!cursor) return null
  const separator = cursor.lastIndexOf("_")
  if (separator < 1) return null
  const updatedAt = new Date(cursor.slice(0, separator))
  const _id = toObjectId(cursor.slice(separator + 1))
  return _id && !Number.isNaN(updatedAt.getTime()) ? { updatedAt, _id } : null
}

export async function listMessageThreadsPage(opts: { ownerId?: string; archived?: boolean; cursor?: string; limit?: number } = {}) {
  const decoded = decodeCursor(opts.cursor)
  const filter: Record<string, unknown> = {
    ...(opts.ownerId ? { ownerId: opts.ownerId } : {}),
    ...(opts.archived ? { archivedAt: { $exists: true } } : { archivedAt: { $exists: false } }),
  }
  if (decoded) filter.$or = [{ updatedAt: { $lt: decoded.updatedAt } }, { updatedAt: decoded.updatedAt, _id: { $lt: decoded._id } }]
  const limit = Math.max(1, Math.min(opts.limit ?? MESSAGE_PAGE_SIZE, 50))
  const threads = await (await collection())
    .find(filter, { projection: { entries: { $slice: -1 } } })
    .sort({ updatedAt: -1, _id: -1 }).limit(limit + 1).toArray()
  const hasMore = threads.length > limit
  if (hasMore) threads.pop()
  const last = threads.at(-1)
  return { threads, hasMore, nextCursor: hasMore && last ? `${last.updatedAt.toISOString()}_${last._id}` : null }
}

export async function getMessageThread(id: string) {
  const _id = toObjectId(id)
  return _id ? (await collection()).findOne({ _id }) : null
}

export async function getMessageThreadForOwner(id: string, ownerId: string) {
  const _id = toObjectId(id)
  return _id ? (await collection()).findOne({ _id, ownerId }) : null
}

export async function deleteMessageThread(id: string, ownerId?: string) {
  const _id = toObjectId(id)
  if (!_id) return false
  const result = await (await collection()).deleteOne({ _id, ...(ownerId ? { ownerId } : {}) })
  return result.deletedCount > 0
}

export async function markMessageThreadRead(id: string, readerId: string, ownerId?: string) {
  const _id = toObjectId(id)
  if (!_id) return null
  const now = new Date()
  return (await collection()).findOneAndUpdate(
    { _id, ...(ownerId ? { ownerId } : {}) },
    { $set: { "entries.$[unread].readAt": now } },
    {
      arrayFilters: [{ "unread.authorId": { $ne: readerId }, "unread.readAt": { $exists: false } }],
      returnDocument: "after",
    }
  )
}

export async function setMessageThreadStatus(id: string, status: MessageThread["status"]) {
  const _id = toObjectId(id)
  if (!_id) return null
  return (await collection()).findOneAndUpdate(
    { _id }, { $set: { status, updatedAt: new Date() } }, { returnDocument: "after" }
  )
}

export async function setMessageThreadArchived(id: string, archived: boolean) {
  const _id = toObjectId(id)
  if (!_id) return null
  return (await collection()).findOneAndUpdate(
    { _id }, archived ? { $set: { archivedAt: new Date() } } : { $unset: { archivedAt: "" } },
    { returnDocument: "after" }
  )
}

export async function unreadMessageCount(viewerId: string, admin: boolean) {
  const match = admin ? {} : { ownerId: viewerId }
  const result = await (await collection()).aggregate<{ total: number }>([
    { $match: match },
    { $unwind: "$entries" },
    { $match: { "entries.authorId": { $ne: viewerId }, "entries.readAt": { $exists: false } } },
    { $count: "total" },
  ]).next()
  return result?.total ?? 0
}

export async function countOpenMessageThreads(ownerId: string) {
  return (await collection()).countDocuments({ ownerId, status: "open" }, { limit: MAX_OPEN_THREADS_PER_USER })
}

export async function addMessageReply(id: string, data: { authorId: string; authorName: string; body: string; isAdmin: boolean; ownerId?: string }) {
  const _id = toObjectId(id)
  if (!_id) return null
  const now = new Date()
  const entry: MessageEntry = { _id: new ObjectId(), authorId: data.authorId, authorName: data.authorName, body: data.body, createdAt: now }
  return (await collection()).findOneAndUpdate(
    { _id, status: { $ne: "closed" }, ...(data.ownerId ? { ownerId: data.ownerId } : {}), [`entries.${MAX_THREAD_ENTRIES - 1}`]: { $exists: false } },
    { $push: { entries: entry }, $set: { updatedAt: now, status: data.isAdmin ? "answered" : "open" } },
    { returnDocument: "after" }
  )
}

export function serializeMessageThread(thread: MessageThread, viewerId: string) {
  return {
    _id: thread._id.toString(),
    ownerName: thread.ownerName,
    subject: thread.subject,
    category: thread.category ?? "other",
    status: thread.status,
    archivedAt: thread.archivedAt?.toISOString(),
    createdAt: thread.createdAt.toISOString(), updatedAt: thread.updatedAt.toISOString(),
    entries: (thread.entries ?? []).map((entry) => ({
      _id: entry._id.toString(), authorName: entry.authorName, body: entry.body,
      createdAt: entry.createdAt.toISOString(), readAt: entry.readAt?.toISOString(),
      isOwn: entry.authorId === viewerId,
    })),
  }
}

export function serializeMessageThreadSummary(thread: Omit<MessageThread, "entries"> & { entries?: MessageEntry[] }) {
  return {
    _id: thread._id.toString(), ownerName: thread.ownerName, subject: thread.subject,
    category: thread.category ?? "other", status: thread.status,
    archivedAt: thread.archivedAt?.toISOString(),
    lastMessage: thread.entries?.at(-1) ? {
      authorName: thread.entries.at(-1)!.authorName,
      body: thread.entries.at(-1)!.body,
      createdAt: thread.entries.at(-1)!.createdAt.toISOString(),
    } : null,
    createdAt: thread.createdAt.toISOString(), updatedAt: thread.updatedAt.toISOString(),
  }
}
