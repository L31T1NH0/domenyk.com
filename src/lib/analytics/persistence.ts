import type { Db } from "mongodb";

export const ANALYTICS_COLLECTIONS = {
  eventsRaw: "events_raw",
  readState: "read_state",
  pageRollups: "page_rollups_daily",
  referrerRollups: "referrer_rollups_daily",
  uaRollups: "ua_dims_daily",
} as const;

const EVENTS_TTL_SECONDS = 60 * 24 * 60 * 60; // 60 dias

export async function ensureAnalyticsIndexes(db: Db): Promise<void> {
  const events = db.collection(ANALYTICS_COLLECTIONS.eventsRaw);
  const readState = db.collection(ANALYTICS_COLLECTIONS.readState);
  const pageRollups = db.collection(ANALYTICS_COLLECTIONS.pageRollups);
  const referrerRollups = db.collection(ANALYTICS_COLLECTIONS.referrerRollups);
  const uaRollups = db.collection(ANALYTICS_COLLECTIONS.uaRollups);

  await Promise.all([
    events.createIndex({ serverTs: 1 }, { expireAfterSeconds: EVENTS_TTL_SECONDS }),
    events.createIndex({ path: 1, serverTs: -1 }),
    events.createIndex({ session: 1 }),
    events.createIndex({ name: 1, path: 1, serverTs: -1 }),
  ]);

  await Promise.all([
    readState.createIndex({ session: 1, path: 1 }, { unique: true }),
    readState.createIndex({ lastAt: -1 }),
  ]);

  await Promise.all([
    pageRollups.createIndex({ path: 1, day: -1 }),
    pageRollups.createIndex({ day: -1 }),
    referrerRollups.createIndex({ referrer: 1, day: -1 }),
    uaRollups.createIndex({ deviceType: 1, os: 1, browser: 1, day: -1 }),
  ]);
}
