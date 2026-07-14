import "server-only"

import { ObjectId } from "mongodb"
import { getDb } from "./client"

export const PUSH_TOPICS = ["posts", "notes"] as const
export type PushTopic = (typeof PUSH_TOPICS)[number]

export type StoredPushSubscription = {
  _id: ObjectId
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
  topics: PushTopic[]
  adminEvents: boolean
  adminUserId?: string
  userAgent?: string
  failureCount: number
  lastSuccessAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type PushCampaign = {
  _id: ObjectId
  dedupeKey: string
  source: "automatic" | "manual"
  topic: PushTopic
  contentType: "post" | "note"
  contentId: string
  title: string
  body: string
  url: string
  status: "sending" | "sent" | "failed"
  sentCount: number
  failedCount: number
  createdAt: Date
  completedAt?: Date
}

let subscriptionIndexes: Promise<unknown> | undefined
let campaignIndexes: Promise<unknown> | undefined

async function subscriptions() {
  const col = (await getDb()).collection<StoredPushSubscription>("push_subscriptions")
  subscriptionIndexes ??= Promise.all([
    col.createIndex({ endpoint: 1 }, { unique: true }),
    col.createIndex({ topics: 1, updatedAt: -1 }),
    col.createIndex({ adminEvents: 1, adminUserId: 1 }),
  ])
  await subscriptionIndexes
  return col
}

async function campaigns() {
  const col = (await getDb()).collection<PushCampaign>("push_campaigns")
  campaignIndexes ??= Promise.all([
    col.createIndex({ dedupeKey: 1 }, { unique: true }),
    col.createIndex({ createdAt: -1 }),
  ])
  await campaignIndexes
  return col
}

export async function upsertPushSubscription(data: {
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
  topics: PushTopic[]
  userAgent?: string
  admin?: { enabled: boolean; userId: string }
}) {
  const now = new Date()
  const $set: Record<string, unknown> = {
    expirationTime: data.expirationTime,
    keys: data.keys,
    topics: data.topics,
    userAgent: data.userAgent,
    failureCount: 0,
    updatedAt: now,
  }
  const $unset: Record<string, ""> = {}
  const $setOnInsert: Record<string, unknown> = {
    _id: new ObjectId(),
    endpoint: data.endpoint,
    createdAt: now,
  }

  if (data.admin) {
    $set.adminEvents = data.admin.enabled
    if (data.admin.enabled) $set.adminUserId = data.admin.userId
    else $unset.adminUserId = ""
  } else {
    $setOnInsert.adminEvents = false
  }

  await (await subscriptions()).updateOne(
    { endpoint: data.endpoint },
    {
      $set,
      $setOnInsert,
      ...(Object.keys($unset).length ? { $unset } : {}),
    },
    { upsert: true }
  )
}

export async function getPushSubscription(endpoint: string) {
  return (await subscriptions()).findOne({ endpoint })
}

export async function deletePushSubscription(endpoint: string) {
  await (await subscriptions()).deleteOne({ endpoint })
}

export async function deletePushSubscriptions(endpoints: string[]) {
  if (endpoints.length === 0) return
  await (await subscriptions()).deleteMany({ endpoint: { $in: endpoints } })
}

export async function listPushSubscriptionsForTopic(topic: PushTopic) {
  return (await subscriptions()).find({ topics: topic }).toArray()
}

export async function listAdminPushSubscriptions(adminUserId: string) {
  return (await subscriptions()).find({ adminEvents: true, adminUserId }).toArray()
}

export async function recordPushSuccess(endpoint: string) {
  await (await subscriptions()).updateOne(
    { endpoint },
    { $set: { lastSuccessAt: new Date(), failureCount: 0 } }
  )
}

export async function recordPushFailure(endpoint: string) {
  await (await subscriptions()).updateOne({ endpoint }, { $inc: { failureCount: 1 } })
}

export async function pushSubscriptionCounts() {
  const col = await subscriptions()
  const [devices, posts, notes, adminDevices] = await Promise.all([
    col.countDocuments(),
    col.countDocuments({ topics: "posts" }),
    col.countDocuments({ topics: "notes" }),
    col.countDocuments({ adminEvents: true }),
  ])
  return { devices, posts, notes, adminDevices }
}

export async function claimPushCampaign(data: Omit<PushCampaign, "_id" | "status" | "sentCount" | "failedCount" | "createdAt" | "completedAt">) {
  const campaign: PushCampaign = {
    ...data,
    _id: new ObjectId(),
    status: "sending",
    sentCount: 0,
    failedCount: 0,
    createdAt: new Date(),
  }
  try {
    await (await campaigns()).insertOne(campaign)
    return campaign
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) return null
    throw error
  }
}

export async function completePushCampaign(id: ObjectId, result: { sentCount: number; failedCount: number }) {
  await (await campaigns()).updateOne(
    { _id: id },
    { $set: {
      status: result.failedCount > 0 && result.sentCount === 0 ? "failed" : "sent",
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      completedAt: new Date(),
    } }
  )
}

export async function listPushCampaigns(limit = 12) {
  return (await campaigns()).find().sort({ createdAt: -1 }).limit(Math.min(limit, 50)).toArray()
}
