import "server-only"

import { revalidateTag, unstable_cache } from "next/cache"
import type { AnyBulkWriteOperation } from "mongodb"
import { getDb } from "@/lib/db/client"

// Keep the existing key so current installations preserve their preference.
const SITE_VISIT_PUSH_KEY = "notifications.site-visits.enabled"
const SITE_VISIT_STORE_KEY = "notifications.site-visits.store"
const NOTIFICATION_SETTINGS_CACHE_TAG = "notification-settings"

type BooleanSetting = {
  _id: string
  value: boolean
  updatedAt: Date
}

export type SiteVisitNotificationSettings = {
  pushEnabled: boolean
  storeInHistory: boolean
}

async function readSiteVisitNotificationSettings(): Promise<SiteVisitNotificationSettings> {
  const documents = await (await getDb()).collection<BooleanSetting>("settings").find({
    _id: { $in: [SITE_VISIT_PUSH_KEY, SITE_VISIT_STORE_KEY] },
  }).toArray()
  const settings = new Map(documents.map((document) => [document._id, document.value]))
  return {
    pushEnabled: settings.get(SITE_VISIT_PUSH_KEY) === true,
    storeInHistory: settings.get(SITE_VISIT_STORE_KEY) === true,
  }
}

export const getSiteVisitNotificationSettings = unstable_cache(
  readSiteVisitNotificationSettings,
  ["site-visit-notification-settings"],
  { tags: [NOTIFICATION_SETTINGS_CACHE_TAG], revalidate: 60 }
)

export async function setSiteVisitNotificationSettings(
  input: Partial<SiteVisitNotificationSettings>
): Promise<SiteVisitNotificationSettings> {
  const now = new Date()
  const operations: AnyBulkWriteOperation<BooleanSetting>[] = []
  if (typeof input.pushEnabled === "boolean") {
    operations.push({
      updateOne: {
        filter: { _id: SITE_VISIT_PUSH_KEY },
        update: { $set: { value: input.pushEnabled, updatedAt: now } },
        upsert: true,
      },
    })
  }
  if (typeof input.storeInHistory === "boolean") {
    operations.push({
      updateOne: {
        filter: { _id: SITE_VISIT_STORE_KEY },
        update: { $set: { value: input.storeInHistory, updatedAt: now } },
        upsert: true,
      },
    })
  }
  if (operations.length > 0) {
    await (await getDb()).collection<BooleanSetting>("settings").bulkWrite(operations)
    revalidateTag(NOTIFICATION_SETTINGS_CACHE_TAG, { expire: 0 })
  }
  return readSiteVisitNotificationSettings()
}
