import { MongoClient, ObjectId } from "mongodb"

import { dailyNotificationAggregateKey, notificationDay } from "../src/lib/notification-aggregation.ts"

const DAILY_KEY_SUFFIX = /:day:\d{4}-\d{2}-\d{2}$/
const LEGACY_AGGREGATE_KEY = /^(?:view:|note-view:)/
const MAX_NOTIFICATION_OCCURRENCES = 200

function occurrenceDate(occurrence) {
  if (occurrence instanceof Date) return occurrence
  return occurrence?.occurredAt instanceof Date ? occurrence.occurredAt : null
}

function notificationOccurrences(notification) {
  const stored = (notification.occurrences ?? []).filter((occurrence) => occurrenceDate(occurrence))
  if (stored.length > 0) return stored
  if (notification.count > 1 && notification.createdAt.getTime() !== notification.updatedAt.getTime()) {
    return [{ occurredAt: notification.createdAt }, { occurredAt: notification.updatedAt }]
  }
  return [{ occurredAt: notification.updatedAt }]
}

function splitNotification(notification) {
  const grouped = new Map()
  const occurrences = notificationOccurrences(notification)

  for (const occurrence of occurrences) {
    const day = notificationDay(occurrenceDate(occurrence))
    const group = grouped.get(day) ?? []
    group.push(occurrence)
    grouped.set(day, group)
  }

  const groups = [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, groupOccurrences]) => {
      const dates = groupOccurrences.map(occurrenceDate)
      const aggregateKey = notification.aggregateKey
      const shared = { ...notification }
      delete shared._id
      delete shared.aggregateKey
      delete shared.count
      delete shared.occurrences
      delete shared.createdAt
      delete shared.updatedAt
      return {
        ...shared,
        aggregateKey: dailyNotificationAggregateKey(aggregateKey, dates[0]),
        count: groupOccurrences.length,
        occurrences: groupOccurrences,
        createdAt: new Date(Math.min(...dates.map((date) => date.getTime()))),
        updatedAt: new Date(Math.max(...dates.map((date) => date.getTime()))),
        day,
      }
    })

  const missingOccurrences = Math.max(0, notification.count - occurrences.length)
  if (groups[0]) groups[0].count += missingOccurrences
  return groups
}

function mergeNotifications(existing, incoming) {
  const existingOccurrences = notificationOccurrences(existing)
  const combinedOccurrences = [...existingOccurrences, ...incoming.occurrences]
    .sort((left, right) => occurrenceDate(left).getTime() - occurrenceDate(right).getTime())
    .slice(-MAX_NOTIFICATION_OCCURRENCES)
  const incomingIsNewer = incoming.updatedAt >= existing.updatedAt
  const newer = incomingIsNewer ? incoming : existing
  const readAt = existing.readAt && incoming.readAt
    ? new Date(Math.max(existing.readAt.getTime(), incoming.readAt.getTime()))
    : undefined
  const incomingDocument = { ...incoming }
  const newerDocument = { ...newer }
  delete incomingDocument.day
  delete incomingDocument._id
  delete newerDocument.day

  const merged = {
    ...incomingDocument,
    ...newerDocument,
    _id: existing._id,
    aggregateKey: incoming.aggregateKey,
    count: existing.count + incoming.count,
    occurrences: combinedOccurrences,
    createdAt: new Date(Math.min(existing.createdAt.getTime(), incoming.createdAt.getTime())),
    updatedAt: new Date(Math.max(existing.updatedAt.getTime(), incoming.updatedAt.getTime())),
  }
  if (readAt) merged.readAt = readAt
  else delete merged.readAt
  return merged
}

function legacyQuery() {
  return {
    aggregateKey: { $regex: LEGACY_AGGREGATE_KEY, $not: DAILY_KEY_SUFFIX },
    kind: "view",
  }
}

const apply = process.argv.includes("--apply")
const uri = process.env.MONGODB_URI
if (!uri) throw new Error("MONGODB_URI is not set")

const client = new MongoClient(uri)
await client.connect()

try {
  const notifications = client.db("blog").collection("notifications")
  const legacyNotifications = await notifications.find(legacyQuery()).sort({ updatedAt: 1 }).toArray()
  const plannedGroups = legacyNotifications.flatMap((notification) => splitNotification(notification))

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    legacyNotifications: legacyNotifications.length,
    resultingDailyNotifications: plannedGroups.length,
    groups: legacyNotifications.map((notification) => ({
      id: notification._id.toString(),
      aggregateKey: notification.aggregateKey,
      count: notification.count,
      days: splitNotification(notification).map((group) => ({ day: group.day, count: group.count })),
    })),
  }, null, 2))

  if (!apply || legacyNotifications.length === 0) process.exitCode = 0
  else {
    const session = client.startSession()
    try {
      await session.withTransaction(async () => {
        for (const candidate of legacyNotifications) {
          const source = await notifications.findOne({ _id: candidate._id, ...legacyQuery() }, { session })
          if (!source) continue

          const groups = splitNotification(source)
          await notifications.deleteOne({ _id: source._id }, { session })

          let sourceIdAvailable = true
          for (const group of groups) {
            const dailyDocument = { ...group }
            delete dailyDocument.day
            const existing = await notifications.findOne({
              recipientId: source.recipientId,
              aggregateKey: dailyDocument.aggregateKey,
            }, { session })

            if (existing) {
              await notifications.replaceOne(
                { _id: existing._id },
                mergeNotifications(existing, dailyDocument),
                { session }
              )
              continue
            }

            const _id = sourceIdAvailable ? source._id : new ObjectId()
            sourceIdAvailable = false
            await notifications.insertOne({ _id, ...dailyDocument }, { session })
          }
        }
      })
    } finally {
      await session.endSession()
    }

    const remaining = await notifications.countDocuments(legacyQuery())
    console.log(JSON.stringify({ migrated: legacyNotifications.length, remainingLegacyNotifications: remaining }))
    if (remaining !== 0) process.exitCode = 1
  }
} finally {
  await client.close()
}
