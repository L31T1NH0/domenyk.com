import type { Db } from "mongodb";

import {
  ANALYTICS_COLLECTIONS,
  ensureAnalyticsIndexes,
} from "./persistence";

const FUNNEL_BUCKETS = Array.from({ length: 21 }, (_, i) => i * 5);
const MAX_SESSION_ACTIVE_MS = 2 * 60 * 60 * 1000;

type RawEventDoc = {
  name: string;
  session: string;
  path: string;
  referrer?: string | null;
  deviceType?: string | null;
  os?: string | null;
  browser?: string | null;
  progressBucket?: number;
  clientTs: Date;
  serverTs: Date;
};

type ReadStateDoc = {
  session: string;
  path: string;
  progress_max: number;
  completed: boolean;
  firstAt: Date;
  lastAt: Date;
  time_active_ms: number;
  referrer?: string | null;
  deviceType?: string | null;
  os?: string | null;
  browser?: string | null;
};

type PageRollupDoc = {
  path: string;
  day: Date;
  views: number;
  sessions: number;
  time_active_avg_ms: number;
  time_active_median_ms: number;
  time_active_p95_ms: number;
  completion_rate: number;
  funnel: Record<string, number>;
  updatedAt: Date;
};

type ReferrerRollupDoc = {
  referrer: string | null;
  day: Date;
  views: number;
  sessions: number;
  updatedAt: Date;
};

type UaRollupDoc = {
  deviceType: string;
  os: string;
  browser: string;
  day: Date;
  views: number;
  sessions: number;
  updatedAt: Date;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function enumerateDays(from: Date, to: Date): Date[] {
  const start = startOfUtcDay(from);
  const end = startOfUtcDay(to);
  const days: Date[] = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

function computePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  if (upper >= sorted.length) {
    return sorted[sorted.length - 1];
  }
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

async function recomputeDay(db: Db, day: Date): Promise<void> {
  const start = startOfUtcDay(day);
  const end = addUtcDays(start, 1);

  const events = db.collection<RawEventDoc>(ANALYTICS_COLLECTIONS.eventsRaw);
  const readState = db.collection<ReadStateDoc>(ANALYTICS_COLLECTIONS.readState);
  const pageRollups = db.collection<PageRollupDoc>(ANALYTICS_COLLECTIONS.pageRollups);
  const referrerRollups = db.collection<ReferrerRollupDoc>(ANALYTICS_COLLECTIONS.referrerRollups);
  const uaRollups = db.collection<UaRollupDoc>(ANALYTICS_COLLECTIONS.uaRollups);

  const viewRows = await events
    .aggregate<{ _id: string | null; views: number }>([
      { $match: { serverTs: { $gte: start, $lt: end }, name: "page_view" } },
      { $group: { _id: "$path", views: { $sum: 1 } } },
    ])
    .toArray();

  const states = await readState
    .find({ lastAt: { $gte: start, $lt: end } })
    .toArray();

  const metrics = new Map<string, {
    path: string;
    views: number;
    sessions: number;
    times: number[];
    funnel: Map<number, number>;
  }>();

  const ensureEntry = (path: string) => {
    let entry = metrics.get(path);
    if (!entry) {
      entry = {
        path,
        views: 0,
        sessions: 0,
        times: [],
        funnel: new Map<number, number>(),
      };
      metrics.set(path, entry);
    }
    return entry;
  };

  for (const row of viewRows) {
    if (!row._id) {
      continue;
    }
    const entry = ensureEntry(row._id);
    entry.views = row.views;
  }

  for (const state of states) {
    if (!state.path) {
      continue;
    }
    const entry = ensureEntry(state.path);
    entry.sessions += 1;
    const timeActive = Math.max(0, Math.min(MAX_SESSION_ACTIVE_MS, Math.round(state.time_active_ms ?? 0)));
    entry.times.push(timeActive);
    const progress = Math.max(0, Math.min(100, Math.round(state.progress_max ?? 0)));
    for (const bucket of FUNNEL_BUCKETS) {
      if (progress >= bucket) {
        entry.funnel.set(bucket, (entry.funnel.get(bucket) ?? 0) + 1);
      }
    }
  }

  const pageDocs: PageRollupDoc[] = [];
  for (const entry of metrics.values()) {
    const sortedTimes = entry.times.slice().sort((a, b) => a - b);
    const totalTime = entry.times.reduce((acc, value) => acc + value, 0);
    const average = entry.sessions > 0 ? totalTime / entry.sessions : 0;
    const median = computePercentile(sortedTimes, 0.5);
    const p95 = computePercentile(sortedTimes, 0.95);
    const funnelRecord: Record<string, number> = {};
    for (const bucket of FUNNEL_BUCKETS) {
      funnelRecord[`b${bucket}`] = entry.funnel.get(bucket) ?? 0;
    }
    pageDocs.push({
      path: entry.path,
      day: start,
      views: entry.views,
      sessions: entry.sessions,
      time_active_avg_ms: Math.round(average),
      time_active_median_ms: Math.round(median),
      time_active_p95_ms: Math.round(p95),
      completion_rate:
        entry.sessions > 0 ? (entry.funnel.get(100) ?? 0) / entry.sessions : 0,
      funnel: funnelRecord,
      updatedAt: new Date(),
    });
  }

  await pageRollups.deleteMany({ day: start });
  if (pageDocs.length > 0) {
    await pageRollups.insertMany(pageDocs);
  }

  const referrerRows = await events
    .aggregate<{ _id: string | null; views: number; sessions: number }>([
      { $match: { serverTs: { $gte: start, $lt: end }, name: "page_view" } },
      {
        $group: {
          _id: { referrer: { $ifNull: ["$referrer", null] }, session: "$session" },
          views: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.referrer",
          views: { $sum: "$views" },
          sessions: { $sum: 1 },
        },
      },
    ])
    .toArray();

  await referrerRollups.deleteMany({ day: start });
  if (referrerRows.length > 0) {
    const refDocs: ReferrerRollupDoc[] = referrerRows.map((row) => ({
      referrer: row._id ?? null,
      day: start,
      views: row.views,
      sessions: row.sessions,
      updatedAt: new Date(),
    }));
    await referrerRollups.insertMany(refDocs);
  }

  const uaRows = await events
    .aggregate<{
      _id: { deviceType: string; os: string; browser: string };
      views: number;
      sessions: number;
    }>([
      { $match: { serverTs: { $gte: start, $lt: end }, name: "page_view" } },
      {
        $group: {
          _id: {
            deviceType: { $ifNull: ["$deviceType", "unknown"] },
            os: { $ifNull: ["$os", "unknown"] },
            browser: { $ifNull: ["$browser", "unknown"] },
            session: "$session",
          },
          views: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: {
            deviceType: "$_id.deviceType",
            os: "$_id.os",
            browser: "$_id.browser",
          },
          views: { $sum: "$views" },
          sessions: { $sum: 1 },
        },
      },
    ])
    .toArray();

  await uaRollups.deleteMany({ day: start });
  if (uaRows.length > 0) {
    const uaDocs: UaRollupDoc[] = uaRows.map((row) => ({
      deviceType: row._id.deviceType,
      os: row._id.os,
      browser: row._id.browser,
      day: start,
      views: row.views,
      sessions: row.sessions,
      updatedAt: new Date(),
    }));
    await uaRollups.insertMany(uaDocs);
  }
}

export async function refreshAnalyticsRollups(
  db: Db,
  range: { from: Date; to: Date }
): Promise<void> {
  await ensureAnalyticsIndexes(db);
  const days = enumerateDays(range.from, range.to);
  for (const day of days) {
    await recomputeDay(db, day);
  }
}
