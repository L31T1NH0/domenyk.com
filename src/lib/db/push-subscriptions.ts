import "server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { ObjectId } from "mongodb"
import { getDb } from "./client"

export const PUSH_TOPICS = ["posts", "notes"] as const
export type PushTopic = (typeof PUSH_TOPICS)[number]

export type StoredPushSubscription = {
  _id: ObjectId
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
  authHash?: string
  topics: PushTopic[]
  status?: "pending" | "active"
  challengeTokenHash?: string
  challengeExpiresAt?: Date
  verifiedAt?: Date
  adminEvents: boolean
  adminUserId?: string
  adminVerifiedAt?: Date
  messageEvents: boolean
  messageUserId?: string
  messageVerifiedAt?: Date
  userAgent?: string
  failureCount: number
  lastSuccessAt?: Date
  createdAt: Date
  updatedAt: Date
  retentionUntil: Date
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
  retentionUntil: Date
}

const SUBSCRIPTION_RETENTION_MS = 365 * 24 * 60 * 60_000
const PENDING_SUBSCRIPTION_RETENTION_MS = 24 * 60 * 60_000
const PUSH_CHALLENGE_TTL_MS = 10 * 60_000
const CAMPAIGN_RETENTION_MS = 180 * 24 * 60 * 60_000

function retentionDate(duration: number) {
  return new Date(Date.now() + duration)
}

let subscriptionIndexes: Promise<unknown> | undefined
let campaignIndexes: Promise<unknown> | undefined

async function subscriptions() {
  const col = (await getDb()).collection<StoredPushSubscription>("push_subscriptions")
  subscriptionIndexes ??= Promise.all([
    col.createIndex({ endpoint: 1 }, { unique: true }),
    col.createIndex({ topics: 1, updatedAt: -1 }),
    col.createIndex({ adminEvents: 1, adminUserId: 1 }),
    col.createIndex({ messageEvents: 1, messageUserId: 1 }),
    col.createIndex({ retentionUntil: 1 }, { expireAfterSeconds: 0 }),
    col.createIndex({ status: 1, challengeExpiresAt: 1 }),
    col.updateMany(
      { status: { $exists: false } },
      { $set: { status: "active", verifiedAt: new Date() } }
    ),
    col.updateMany(
      { retentionUntil: { $exists: false } },
      { $set: { retentionUntil: retentionDate(SUBSCRIPTION_RETENTION_MS) } }
    ),
  ])
  await subscriptionIndexes
  return col
}

async function campaigns() {
  const col = (await getDb()).collection<PushCampaign>("push_campaigns")
  campaignIndexes ??= Promise.all([
    col.createIndex({ dedupeKey: 1 }, { unique: true }),
    col.createIndex({ createdAt: -1 }),
    col.createIndex({ retentionUntil: 1 }, { expireAfterSeconds: 0 }),
    col.updateMany(
      { retentionUntil: { $exists: false } },
      { $set: { retentionUntil: retentionDate(CAMPAIGN_RETENTION_MS) } }
    ),
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
  messages?: { enabled: boolean; userId: string }
}): Promise<{ subscription: StoredPushSubscription; challengeToken: string | null }> {
  const col = await subscriptions()
  const existing = await col.findOne({ endpoint: data.endpoint })
  const now = new Date()
  const needsChallenge = existing?.status !== "active"
  const challengeToken = needsChallenge ? randomBytes(32).toString("base64url") : null
  const $set: Record<string, unknown> = {
    expirationTime: data.expirationTime,
    keys: data.keys,
    authHash: pushAuthHash(data.keys.auth),
    topics: data.topics,
    status: needsChallenge ? "pending" : "active",
    userAgent: data.userAgent,
    failureCount: 0,
    updatedAt: now,
    retentionUntil: retentionDate(
      needsChallenge ? PENDING_SUBSCRIPTION_RETENTION_MS : SUBSCRIPTION_RETENTION_MS
    ),
  }
  const $unset: Record<string, ""> = {}
  const $setOnInsert: Record<string, unknown> = {
    _id: new ObjectId(),
    endpoint: data.endpoint,
    createdAt: now,
  }

  if (challengeToken) {
    $set.challengeTokenHash = pushChallengeHash(challengeToken)
    $set.challengeExpiresAt = new Date(now.getTime() + PUSH_CHALLENGE_TTL_MS)
    $unset.verifiedAt = ""
  }

  if (data.admin) {
    $set.adminEvents = data.admin.enabled
    if (data.admin.enabled) {
      $set.adminUserId = data.admin.userId
      $set.adminVerifiedAt = now
    } else {
      $unset.adminUserId = ""
      $unset.adminVerifiedAt = ""
    }
  } else {
    $set.adminEvents = false
    $unset.adminUserId = ""
    $unset.adminVerifiedAt = ""
  }

  if (data.messages) {
    $set.messageEvents = data.messages.enabled
    if (data.messages.enabled) {
      $set.messageUserId = data.messages.userId
      $set.messageVerifiedAt = now
    } else {
      $unset.messageUserId = ""
      $unset.messageVerifiedAt = ""
    }
  } else {
    $set.messageEvents = false
    $unset.messageUserId = ""
    $unset.messageVerifiedAt = ""
  }

  const subscription = await col.findOneAndUpdate(
    { endpoint: data.endpoint },
    {
      $set,
      $setOnInsert,
      ...(Object.keys($unset).length ? { $unset } : {}),
    },
    { upsert: true, returnDocument: "after" }
  )
  if (!subscription) throw new Error("Não foi possível salvar a inscrição Push.")
  return { subscription, challengeToken }
}

function pushAuthHash(auth: string): string {
  return createHash("sha256").update("domenyk:push-auth:v1\0").update(auth).digest("hex")
}

function pushChallengeHash(token: string): string {
  return createHash("sha256").update("domenyk:push-challenge:v1\0").update(token).digest("hex")
}

function equalHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"))
}

export function pushCapabilityMatches(subscription: StoredPushSubscription, auth: string): boolean {
  const expected = subscription.authHash ?? pushAuthHash(subscription.keys.auth)
  return equalHex(expected, pushAuthHash(auth))
}

export async function verifyPushSubscriptionChallenge(
  endpoint: string,
  auth: string,
  challengeToken: string
): Promise<boolean> {
  const col = await subscriptions()
  const subscription = await col.findOne({ endpoint, status: "pending" })
  if (
    !subscription ||
    !pushCapabilityMatches(subscription, auth) ||
    !subscription.challengeTokenHash ||
    !equalHex(subscription.challengeTokenHash, pushChallengeHash(challengeToken))
  ) return false

  const now = new Date()
  if (!subscription.challengeExpiresAt || subscription.challengeExpiresAt <= now) return false

  const result = await col.updateOne(
    {
      _id: subscription._id,
      status: "pending",
      challengeTokenHash: subscription.challengeTokenHash,
      challengeExpiresAt: { $gt: now },
    },
    {
      $set: {
        status: "active",
        verifiedAt: now,
        updatedAt: now,
        retentionUntil: retentionDate(SUBSCRIPTION_RETENTION_MS),
      },
      $unset: { challengeTokenHash: "", challengeExpiresAt: "" },
    }
  )
  return result.modifiedCount === 1
}

export async function getPushSubscription(endpoint: string) {
  return (await subscriptions()).findOne({ endpoint })
}

export async function deletePushSubscription(endpoint: string) {
  await (await subscriptions()).deleteOne({ endpoint })
}

export async function revokePrivatePushSubscription(endpoint: string, userId: string) {
  const col = await subscriptions()
  await Promise.all([
    col.updateOne(
      { endpoint, adminUserId: userId },
      { $set: { adminEvents: false, updatedAt: new Date() }, $unset: { adminUserId: "", adminVerifiedAt: "" } }
    ),
    col.updateOne(
      { endpoint, messageUserId: userId },
      { $set: { messageEvents: false, updatedAt: new Date() }, $unset: { messageUserId: "", messageVerifiedAt: "" } }
    ),
  ])
}

export async function verifyAdminPushSubscription(endpoint: string, adminUserId: string) {
  await (await subscriptions()).updateOne(
    { endpoint, adminEvents: true, adminUserId },
    { $set: { adminVerifiedAt: new Date(), retentionUntil: retentionDate(SUBSCRIPTION_RETENTION_MS) } }
  )
}

export async function verifyMessagePushSubscription(endpoint: string, userId: string) {
  await (await subscriptions()).updateOne(
    { endpoint, messageEvents: true, messageUserId: userId },
    { $set: { messageVerifiedAt: new Date(), retentionUntil: retentionDate(SUBSCRIPTION_RETENTION_MS) } }
  )
}

export async function revokeAdminPushDevice(id: string, adminUserId: string) {
  if (!ObjectId.isValid(id)) return false
  const result = await (await subscriptions()).updateOne(
    { _id: new ObjectId(id), adminUserId },
    { $set: { adminEvents: false, updatedAt: new Date() }, $unset: { adminUserId: "", adminVerifiedAt: "" } }
  )
  return result.modifiedCount > 0
}

export async function revokeAllAdminPushDevices(adminUserId: string) {
  const result = await (await subscriptions()).updateMany(
    { adminEvents: true, adminUserId },
    { $set: { adminEvents: false, updatedAt: new Date() }, $unset: { adminUserId: "", adminVerifiedAt: "" } }
  )
  return result.modifiedCount
}

export async function deletePushSubscriptions(endpoints: string[]) {
  if (endpoints.length === 0) return
  await (await subscriptions()).deleteMany({ endpoint: { $in: endpoints } })
}

export async function listPushSubscriptionsForTopic(topic: PushTopic) {
  return (await subscriptions()).find({ status: "active", topics: topic }).toArray()
}

export async function listAdminPushSubscriptions(adminUserId: string) {
  return (await subscriptions()).find({ status: "active", adminEvents: true, adminUserId, adminVerifiedAt: { $type: "date" } }).toArray()
}

export async function listMessagePushSubscriptions(userId: string) {
  return (await subscriptions()).find({
    messageEvents: true,
    status: "active",
    messageUserId: userId,
    messageVerifiedAt: { $type: "date" },
  }).toArray()
}

export async function recordPushSuccess(endpoint: string) {
  const now = new Date()
  await (await subscriptions()).updateOne(
    { endpoint },
    { $set: {
      lastSuccessAt: now,
      failureCount: 0,
      updatedAt: now,
      retentionUntil: retentionDate(SUBSCRIPTION_RETENTION_MS),
    } }
  )
}

export async function recordPushFailure(endpoint: string) {
  await (await subscriptions()).updateOne({ endpoint }, { $inc: { failureCount: 1 } })
  const result = await (await subscriptions()).deleteOne({ endpoint, failureCount: { $gte: 3 } })
  return result.deletedCount > 0
}

export async function pushSubscriptionCounts() {
  const col = await subscriptions()
  const [devices, posts, notes, adminDevices] = await Promise.all([
    col.countDocuments({ status: "active" }),
    col.countDocuments({ status: "active", topics: "posts" }),
    col.countDocuments({ status: "active", topics: "notes" }),
    col.countDocuments({ status: "active", adminEvents: true, adminVerifiedAt: { $type: "date" } }),
  ])
  return { devices, posts, notes, adminDevices }
}

export async function claimPushCampaign(data: Omit<PushCampaign, "_id" | "status" | "sentCount" | "failedCount" | "createdAt" | "completedAt" | "retentionUntil">) {
  const campaign: PushCampaign = {
    ...data,
    _id: new ObjectId(),
    status: "sending",
    sentCount: 0,
    failedCount: 0,
    createdAt: new Date(),
    retentionUntil: retentionDate(CAMPAIGN_RETENTION_MS),
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
