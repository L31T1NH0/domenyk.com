import "server-only"

import { createHash, randomUUID } from "node:crypto"
import {
  aggregateNotification as storeAggregateNotification,
  createNotification as storeNotification,
  createNotificationOnce as storeNotificationOnce,
  type AggregateNotificationInput,
  type NotificationInput,
  type NotificationOccurrenceDetails,
} from "@/lib/db/notifications"
import type { AdminPushTopic } from "@/lib/notification-events"
import { sendAdminPush } from "@/lib/push"
import { rateLimit } from "@/lib/rate-limit"

const AGGREGATE_PUSH_WINDOW_MS = 10 * 60_000

function pushPayload(data: Pick<NotificationInput, "title" | "description" | "href">) {
  return {
    title: data.title,
    body: data.description,
    url: data.href,
  }
}

export async function createNotification(
  data: NotificationInput,
  topic: AdminPushTopic,
  occurrenceDetails: NotificationOccurrenceDetails = {}
) {
  const notificationId = await storeNotification(data, occurrenceDetails)
  if (!notificationId) return null

  await sendAdminPush(topic, {
    ...pushPayload(data),
    tag: `admin-${topic}-${notificationId.toString()}`,
  }).catch(() => undefined)
  return notificationId
}

export async function createNotificationOnce(
  data: NotificationInput & { aggregateKey: string },
  topic: AdminPushTopic,
  occurrenceDetails: NotificationOccurrenceDetails = {}
) {
  const notificationId = await storeNotificationOnce(data, occurrenceDetails)
  if (!notificationId) return null

  await sendAdminPush(topic, {
    ...pushPayload(data),
    tag: `admin-${topic}-${notificationId.toString()}`,
  }).catch(() => undefined)
  return notificationId
}

export async function aggregateNotification(
  data: AggregateNotificationInput,
  topic: AdminPushTopic,
  occurrenceDetails: NotificationOccurrenceDetails = {}
) {
  const aggregateKey = await storeAggregateNotification(data, occurrenceDetails)
  const aggregateHash = createHash("sha256").update(aggregateKey).digest("hex").slice(0, 20)
  if (await rateLimit(`notification-push:${topic}:${aggregateHash}`, {
    limit: 1,
    windowMs: AGGREGATE_PUSH_WINDOW_MS,
  })) {
    await sendAdminPush(topic, {
      ...pushPayload(data),
      tag: `admin-${topic}-${aggregateHash}`,
    }).catch(() => undefined)
  }
  return aggregateKey
}

export async function notifySiteVisit(input: {
  data: AggregateNotificationInput
  occurrenceDetails?: NotificationOccurrenceDetails
  storeInHistory: boolean
}) {
  await Promise.all([
    input.storeInHistory
      ? storeAggregateNotification(input.data, input.occurrenceDetails).catch(() => undefined)
      : Promise.resolve(),
    sendAdminPush("site_visits", {
      ...pushPayload(input.data),
      tag: `admin-site-visit-${randomUUID()}`,
    }).catch(() => undefined),
  ])
}
