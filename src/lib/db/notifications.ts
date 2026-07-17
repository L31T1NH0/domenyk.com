import "server-only"

import { createHash } from "crypto"
import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { toObjectId } from "../validation"
import { sendAdminPush } from "../push"
import { rateLimit } from "../rate-limit"

type NotificationKind = "account" | "comment" | "message" | "reply" | "view"

export type NotificationOccurrenceDetails = {
  id?: string
  source?: string
  device?: string
  browser?: string
  os?: string
  location?: string
  campaign?: string
  landingPage?: string
  language?: string
  visitorType?: string
  trafficType?: string
  reading?: {
    completedAt: Date
    activeSeconds: number
    progress: number
  }
  actions?: Array<{
    type: "copied_link" | "commented" | "sent_message"
    occurredAt: Date
  }>
}

type NotificationOccurrence = NotificationOccurrenceDetails & {
  occurredAt: Date
}

const MAX_NOTIFICATION_OCCURRENCES = 200
const ENGAGEMENT_TOKEN_TTL_MS = 4 * 60 * 60_000
const AGGREGATE_PUSH_WINDOW_MS = 10 * 60_000

export type Notification = {
  _id: ObjectId
  recipientId: string
  kind: NotificationKind
  title: string
  description: string
  href: string
  actorId?: string
  actorImageUrl?: string
  aggregateKey?: string
  count: number
  occurrences?: Array<Date | NotificationOccurrence>
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

export async function createNotification(
  data: Omit<Notification, "_id" | "count" | "occurrences" | "createdAt" | "updatedAt">,
  occurrenceDetails: NotificationOccurrenceDetails = {}
) {
  if (data.actorId && data.actorId === data.recipientId) return null
  const now = new Date()
  const result = await (await collection()).insertOne({
    ...data,
    count: 1,
    occurrences: [{ occurredAt: now, ...occurrenceDetails }],
    createdAt: now,
    updatedAt: now,
  } as Notification)
  await sendAdminPush({
    title: data.title,
    body: data.description,
    url: data.href,
    tag: `admin-${data.kind}-${result.insertedId.toString()}`,
  }).catch(() => undefined)
  return result.insertedId
}

export async function createNotificationOnce(
  data: Omit<Notification, "_id" | "count" | "occurrences" | "createdAt" | "updatedAt"> & { aggregateKey: string },
  occurrenceDetails: NotificationOccurrenceDetails = {}
) {
  if (data.actorId && data.actorId === data.recipientId) return null
  const now = new Date()
  let result
  try {
    result = await (await collection()).updateOne(
      { recipientId: data.recipientId, aggregateKey: data.aggregateKey },
      {
        $setOnInsert: {
          ...data,
          count: 1,
          occurrences: [{ occurredAt: now, ...occurrenceDetails }],
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    )
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) return null
    throw error
  }
  if (!result.upsertedId) return null

  await sendAdminPush({
    title: data.title,
    body: data.description,
    url: data.href,
    tag: `admin-${data.kind}-${result.upsertedId.toString()}`,
  }).catch(() => undefined)
  return result.upsertedId
}

export async function aggregateNotification(
  data: Omit<Notification, "_id" | "count" | "occurrences" | "readAt" | "createdAt" | "updatedAt"> & { aggregateKey: string },
  occurrenceDetails: NotificationOccurrenceDetails = {}
) {
  const now = new Date()
  const occurrence: NotificationOccurrence = { occurredAt: now, ...occurrenceDetails }
  await (await collection()).updateOne(
    { recipientId: data.recipientId, aggregateKey: data.aggregateKey },
    [
      {
        $set: {
          kind: data.kind,
          title: data.title,
          description: data.description,
          href: data.href,
          recipientId: data.recipientId,
          aggregateKey: data.aggregateKey,
          createdAt: { $ifNull: ["$createdAt", now] },
          updatedAt: now,
          count: { $add: [{ $ifNull: ["$count", 0] }, 1] },
          occurrences: {
            $slice: [
              {
                $concatArrays: [
                  {
                    $ifNull: [
                      "$occurrences",
                      { $cond: [{ $ne: [{ $type: "$createdAt" }, "missing"] }, ["$createdAt"], []] },
                    ],
                  },
                  [occurrence],
                ],
              },
              -MAX_NOTIFICATION_OCCURRENCES,
            ],
          },
          readAt: "$$REMOVE",
        },
      },
    ],
    { upsert: true }
  )
  const aggregateHash = createHash("sha256").update(data.aggregateKey).digest("hex").slice(0, 20)
  if (await rateLimit(`notification-push:${aggregateHash}`, { limit: 1, windowMs: AGGREGATE_PUSH_WINDOW_MS })) {
    await sendAdminPush({
      title: data.title,
      body: data.description,
      url: data.href,
      tag: `admin-${data.kind}-${aggregateHash}`,
    }).catch(() => undefined)
  }
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

export async function deleteNotification(id: string, recipientId: string) {
  const _id = toObjectId(id)
  if (!_id) return false
  const result = await (await collection()).deleteOne({ _id, recipientId })
  return result.deletedCount > 0
}

export async function deleteNotificationsForMessageThread(threadId: string) {
  await (await collection()).deleteMany({
    href: { $in: [`/admin/messages#${threadId}`, `/fale-comigo#${threadId}`] },
  })
}

export async function completeNotificationReading(id: string, activeSeconds: number, progress: number) {
  const validSince = new Date(Date.now() - ENGAGEMENT_TOKEN_TTL_MS)
  const result = await (await getDb()).collection("notifications").updateOne(
    {
      occurrences: {
        $elemMatch: {
          id,
          occurredAt: { $gte: validSince },
          reading: { $exists: false },
        },
      },
    },
    { $set: {
      "occurrences.$.reading": {
        completedAt: new Date(),
        activeSeconds,
        progress,
      },
    } }
  )
  return result.modifiedCount > 0
}

export type NotificationActionType = "copied_link" | "commented" | "sent_message"

export async function appendNotificationAction(id: string, type: NotificationActionType) {
  const validSince = new Date(Date.now() - ENGAGEMENT_TOKEN_TTL_MS)
  const action = { type, occurredAt: new Date() }
  const result = await (await getDb()).collection("notifications").updateOne(
    {
      occurrences: {
        $elemMatch: {
          id,
          occurredAt: { $gte: validSince },
          "actions.type": { $ne: type },
        },
      },
    },
    [{
      $set: {
        occurrences: {
          $map: {
            input: "$occurrences",
            as: "occurrence",
            in: {
              $cond: [
                { $eq: ["$$occurrence.id", id] },
                {
                  $mergeObjects: [
                    "$$occurrence",
                    { actions: { $concatArrays: [{ $ifNull: ["$$occurrence.actions", []] }, [action]] } },
                  ],
                },
                "$$occurrence",
              ],
            },
          },
        },
      },
    }]
  )
  return result.modifiedCount > 0
}

export function serializeNotification(notification: Notification) {
  return {
    ...notification,
    _id: notification._id.toString(),
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
    occurrences: notification.occurrences?.map((occurrence) => occurrence instanceof Date
      ? { occurredAt: occurrence.toISOString() }
      : {
          ...occurrence,
          occurredAt: occurrence.occurredAt.toISOString(),
          reading: occurrence.reading
            ? { ...occurrence.reading, completedAt: occurrence.reading.completedAt.toISOString() }
            : undefined,
          actions: occurrence.actions?.map((action) => ({
            ...action,
            occurredAt: action.occurredAt.toISOString(),
          })),
        }),
    readAt: notification.readAt?.toISOString(),
  }
}
