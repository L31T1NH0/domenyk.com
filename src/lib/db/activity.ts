import "server-only"

import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { shiftSiteDateKey, siteDateKey, startOfSiteDay } from "../datetime"

type ActivityEventType = "post_view" | "comment_created"

export type ActivityEvent = {
  _id: ObjectId
  type: ActivityEventType
  occurredAt: Date
  visitorKey: string
  isAuthenticated: boolean
  userId?: string
  userName?: string
  postId?: ObjectId
  postPublicId?: string
  postSlug?: string
  postTitle?: string
  locale?: string
  retentionUntil: Date
}

const ACTIVITY_RETENTION_MS = 90 * 24 * 60 * 60_000

let indexesPromise: Promise<void> | undefined

async function collection() {
  const db = await getDb()
  const col = db.collection<ActivityEvent>("activity_events")
  indexesPromise ??= Promise.all([
    col.createIndex({ occurredAt: -1 }),
    col.createIndex({ type: 1, occurredAt: -1 }),
    col.createIndex({ postPublicId: 1, occurredAt: -1 }),
    col.createIndex({ visitorKey: 1, occurredAt: -1 }),
    col.createIndex(
      { retentionUntil: 1 },
      { expireAfterSeconds: 0, name: "activity_events_retention" }
    ),
    col.updateMany(
      { retentionUntil: { $exists: false } },
      { $set: { retentionUntil: new Date(Date.now() + ACTIVITY_RETENTION_MS) } }
    ),
  ]).then(() => undefined)
  await indexesPromise
  return col
}

export async function recordActivityEvent(event: Omit<ActivityEvent, "_id" | "occurredAt" | "retentionUntil">) {
  const now = new Date()
  await (await collection()).insertOne({
    ...event,
    occurredAt: now,
    retentionUntil: new Date(now.getTime() + ACTIVITY_RETENTION_MS),
  } as ActivityEvent)
}

export type ActivityDashboard = {
  totals: { views: number; comments: number; visitors: number; authenticated: number }
  days: Array<{ date: string; views: number; comments: number }>
  topPosts: Array<{ publicId: string; slug: string; title: string; views: number; comments: number }>
  recent: Array<{
    id: string
    type: ActivityEventType
    occurredAt: string
    isAuthenticated: boolean
    userName?: string
    postSlug?: string
    postTitle?: string
    locale?: string
  }>
}

export async function getActivityDashboard(days = 14): Promise<ActivityDashboard> {
  const col = await collection()
  const currentDateKey = siteDateKey()
  const firstDateKey = shiftSiteDateKey(currentDateKey, -(days - 1))
  const since = startOfSiteDay(new Date(), -(days - 1))

  const [byDay, totalsRow, topPosts, recent] = await Promise.all([
    col.aggregate<{ _id: { date: string; type: ActivityEventType }; count: number }>([
      { $match: { occurredAt: { $gte: since } } },
      { $group: { _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt", timezone: "America/Fortaleza" } }, type: "$type" }, count: { $sum: 1 } } },
    ]).toArray(),
    col.aggregate<{ views: number; comments: number; visitors: string[]; authenticated: number }>([
      { $match: { occurredAt: { $gte: since } } },
      { $group: {
        _id: null,
        views: { $sum: { $cond: [{ $eq: ["$type", "post_view"] }, 1, 0] } },
        comments: { $sum: { $cond: [{ $eq: ["$type", "comment_created"] }, 1, 0] } },
        visitors: { $addToSet: "$visitorKey" },
        authenticated: { $sum: { $cond: ["$isAuthenticated", 1, 0] } },
      } },
    ]).next(),
    col.aggregate<{ _id: string; slug: string; title: string; views: number; comments: number }>([
      { $match: { occurredAt: { $gte: since }, postPublicId: { $type: "string" } } },
      { $group: {
        _id: "$postPublicId", slug: { $last: "$postSlug" }, title: { $last: "$postTitle" },
        views: { $sum: { $cond: [{ $eq: ["$type", "post_view"] }, 1, 0] } },
        comments: { $sum: { $cond: [{ $eq: ["$type", "comment_created"] }, 1, 0] } },
      } },
      { $sort: { views: -1, comments: -1 } }, { $limit: 5 },
    ]).toArray(),
    col.find({}).sort({ occurredAt: -1 }).limit(12).toArray(),
  ])

  const dayMap = new Map(byDay.map((row) => [`${row._id.date}:${row._id.type}`, row.count]))
  const dayRows = Array.from({ length: days }, (_, index) => {
    const key = shiftSiteDateKey(firstDateKey, index)
    return { date: key, views: dayMap.get(`${key}:post_view`) ?? 0, comments: dayMap.get(`${key}:comment_created`) ?? 0 }
  })

  return {
    totals: { views: totalsRow?.views ?? 0, comments: totalsRow?.comments ?? 0, visitors: totalsRow?.visitors.length ?? 0, authenticated: totalsRow?.authenticated ?? 0 },
    days: dayRows,
    topPosts: topPosts.map((row) => ({ publicId: row._id, slug: row.slug, title: row.title, views: row.views, comments: row.comments })),
    recent: recent.map((event) => ({ id: event._id.toString(), type: event.type, occurredAt: event.occurredAt.toISOString(), isAuthenticated: event.isAuthenticated, userName: event.userName, postSlug: event.postSlug, postTitle: event.postTitle, locale: event.locale })),
  }
}
