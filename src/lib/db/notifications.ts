import "server-only"

import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { toObjectId } from "../validation"

export type NotificationKind = "comment" | "message" | "reply" | "view"

export type Notification = {
  _id: ObjectId
  recipientId: string
  kind: NotificationKind
  title: string
  description: string
  href: string
  actorId?: string
  aggregateKey?: string
  count: number
  readAt?: Date
  createdAt: Date
  updatedAt: Date
}

let indexesPromise: Promise<unknown> | undefined

async function collection() {
  const col = (await getDb()).collection<Notification>("notifications")
  indexesPromise ??= Promise.all([
    col.createIndex({ recipientId: 1, updatedAt: -1 }),
    col.createIndex({ recipientId: 1, readAt: 1 }),
    col.createIndex({ recipientId: 1, aggregateKey: 1 }, { unique: true, sparse: true }),
  ])
  await indexesPromise
  return col
}

export async function createNotification(data: Omit<Notification, "_id" | "count" | "createdAt" | "updatedAt">) {
  if (data.actorId && data.actorId === data.recipientId) return null
  const now = new Date()
  const result = await (await collection()).insertOne({ ...data, count: 1, createdAt: now, updatedAt: now } as Notification)
  return result.insertedId
}

export async function aggregateNotification(data: Omit<Notification, "_id" | "count" | "readAt" | "createdAt" | "updatedAt"> & { aggregateKey: string }) {
  const now = new Date()
  await (await collection()).updateOne(
    { recipientId: data.recipientId, aggregateKey: data.aggregateKey },
    {
      $set: { kind: data.kind, title: data.title, description: data.description, href: data.href, updatedAt: now },
      $setOnInsert: { createdAt: now },
      $inc: { count: 1 },
      $unset: { readAt: "" },
    },
    { upsert: true }
  )
}

export async function listNotifications(recipientId: string, limit = 50) {
  return (await collection()).find({ recipientId }).sort({ updatedAt: -1 }).limit(Math.min(limit, 100)).toArray()
}

export async function unreadNotificationCount(recipientId: string) {
  return (await collection()).countDocuments({ recipientId, readAt: { $exists: false } })
}

export async function markNotificationRead(id: string, recipientId: string) {
  const _id = toObjectId(id)
  if (!_id) return false
  const result = await (await collection()).updateOne({ _id, recipientId }, { $set: { readAt: new Date() } })
  return result.matchedCount > 0
}

export async function markAllNotificationsRead(recipientId: string) {
  await (await collection()).updateMany({ recipientId, readAt: { $exists: false } }, { $set: { readAt: new Date() } })
}

export function serializeNotification(notification: Notification) {
  return {
    ...notification,
    _id: notification._id.toString(),
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
    readAt: notification.readAt?.toISOString(),
  }
}
