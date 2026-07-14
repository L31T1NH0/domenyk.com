import "server-only"

import webPush from "web-push"
import { getAdminUserId } from "@/lib/auth"
import {
  claimPushCampaign,
  completePushCampaign,
  deletePushSubscriptions,
  listAdminPushSubscriptions,
  listPushSubscriptionsForTopic,
  recordPushFailure,
  recordPushSuccess,
  type PushTopic,
  type StoredPushSubscription,
} from "@/lib/db/push-subscriptions"

export type PushPayload = {
  title: string
  body: string
  url: string
  tag: string
  kind: "post" | "note" | "admin"
}

function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim()
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export function publicVapidKey() {
  return vapidConfig()?.publicKey ?? null
}

function configureWebPush() {
  const config = vapidConfig()
  if (!config) return false
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  return true
}

function asWebPushSubscription(subscription: StoredPushSubscription): webPush.PushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  }
}

async function deliver(subscriptions: StoredPushSubscription[], payload: PushPayload) {
  if (!configureWebPush()) return { configured: false, sentCount: 0, failedCount: 0 }
  let sentCount = 0
  let failedCount = 0
  const expired: string[] = []
  const message = JSON.stringify(payload)

  for (let index = 0; index < subscriptions.length; index += 20) {
    const batch = subscriptions.slice(index, index + 20)
    await Promise.all(batch.map(async (subscription) => {
      try {
        await webPush.sendNotification(asWebPushSubscription(subscription), message, { TTL: 60 * 60 * 24 })
        sentCount += 1
        await recordPushSuccess(subscription.endpoint)
      } catch (error) {
        failedCount += 1
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : undefined
        if (statusCode === 404 || statusCode === 410) expired.push(subscription.endpoint)
        else {
          const removed = await recordPushFailure(subscription.endpoint).catch(() => false)
          if (removed) expired.push(subscription.endpoint)
        }
      }
    }))
  }

  await deletePushSubscriptions(expired)
  return { configured: true, sentCount, failedCount }
}

export async function sendReaderPush(input: {
  dedupeKey: string
  source: "automatic" | "manual"
  topic: PushTopic
  contentType: "post" | "note"
  contentId: string
  title: string
  body: string
  url: string
}) {
  if (!vapidConfig()) return { configured: false, deduplicated: false, sentCount: 0, failedCount: 0 }
  const campaign = await claimPushCampaign(input)
  if (!campaign) return { configured: true, deduplicated: true, sentCount: 0, failedCount: 0 }

  const result = await deliver(await listPushSubscriptionsForTopic(input.topic), {
    title: input.title,
    body: input.body,
    url: input.url,
    tag: `reader-${campaign._id.toString()}`,
    kind: input.contentType,
  })
  await completePushCampaign(campaign._id, result)
  return { ...result, deduplicated: false }
}

export async function sendAdminPush(payload: Omit<PushPayload, "kind" | "tag"> & { tag?: string }) {
  const adminId = getAdminUserId()
  if (!adminId) return { configured: Boolean(vapidConfig()), sentCount: 0, failedCount: 0 }
  return deliver(await listAdminPushSubscriptions(adminId), {
    ...payload,
    kind: "admin",
    tag: payload.tag ?? `admin-${Date.now()}`,
  })
}
