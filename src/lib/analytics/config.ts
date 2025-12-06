import { getMongoDb } from "@lib/mongo";

import { AnalyticsEventName, parseEnabledEvents } from "./events";

const DEFAULT_ENDPOINT = "/api/analytics/collect";
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_MAX_BATCH_SIZE = 10;
const DEFAULT_MAX_QUEUE_SIZE = 40;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_RATE_LIMIT_MAX_EVENTS = 120;
const DEFAULT_MAX_EVENTS_PER_REQUEST = 25;
const DEFAULT_MAX_EVENT_BYTES = 4096;
const ANALYTICS_ENABLED_CACHE_TTL_MS = 60_000;
const ANALYTICS_ENABLED_SETTING_KEY = "analyticsEnabled";

function toNumber(
  value: string | null | undefined,
  fallback: number,
  { min, max }: { min?: number; max?: number } = {}
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (typeof min === "number" && parsed < min) {
    return min;
  }

  if (typeof max === "number" && parsed > max) {
    return max;
  }

  return parsed;
}

function parseOrigins(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function parseBooleanFlag(value: string | null | undefined, fallback: boolean) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export type AnalyticsClientConfig = {
  endpoint: string;
  enabledEvents: AnalyticsEventName[];
  flushIntervalMs: number;
  maxBatchSize: number;
  maxQueueSize: number;
};

export type AnalyticsServerConfig = {
  endpoint: string;
  enabledEvents: Set<AnalyticsEventName>;
  allowedOrigins: string[];
  rateLimit: {
    windowSeconds: number;
    maxEvents: number;
  };
  maxEventsPerRequest: number;
  maxEventBytes: number;
};

type AnalyticsEnabledSetting = {
  _id: typeof ANALYTICS_ENABLED_SETTING_KEY;
  value: boolean;
  updatedAt?: Date;
};

const DEFAULT_ANALYTICS_ENABLED = parseBooleanFlag(
  process.env.ANALYTICS_ENABLED,
  true
);

let analyticsEnabledCache: { value: boolean; expiresAt: number } | null = null;

function getCachedAnalyticsEnabled(): boolean | null {
  if (analyticsEnabledCache && analyticsEnabledCache.expiresAt > Date.now()) {
    return analyticsEnabledCache.value;
  }
  return null;
}

function setCachedAnalyticsEnabled(value: boolean) {
  analyticsEnabledCache = {
    value,
    expiresAt: Date.now() + ANALYTICS_ENABLED_CACHE_TTL_MS,
  };
}

export async function getAnalyticsEnabled(): Promise<boolean> {
  const cached = getCachedAnalyticsEnabled();
  if (cached !== null) {
    return cached;
  }

  let storedValue: boolean | null = null;

  try {
    const db = await getMongoDb();
    const storedSetting = await db
      .collection<AnalyticsEnabledSetting>("settings")
      .findOne({ _id: ANALYTICS_ENABLED_SETTING_KEY });

    if (storedSetting && typeof storedSetting.value === "boolean") {
      storedValue = storedSetting.value;
    }
  } catch (error) {
    console.warn("Failed to fetch analyticsEnabled from storage", error);
  }

  const value =
    storedValue ?? parseBooleanFlag(process.env.ANALYTICS_ENABLED, DEFAULT_ANALYTICS_ENABLED);
  setCachedAnalyticsEnabled(value);
  return value;
}

export async function setAnalyticsEnabled(enabled: boolean): Promise<boolean> {
  try {
    const db = await getMongoDb();
    await db
      .collection<AnalyticsEnabledSetting>("settings")
      .updateOne(
        { _id: ANALYTICS_ENABLED_SETTING_KEY },
        { $set: { value: enabled, updatedAt: new Date() } },
        { upsert: true }
      );
  } catch (error) {
    console.error("Failed to persist analyticsEnabled flag", error);
    throw error;
  }

  setCachedAnalyticsEnabled(enabled);
  return enabled;
}

export function getAnalyticsClientConfig(): AnalyticsClientConfig {
  const enabledEvents = parseEnabledEvents(process.env.ANALYTICS_ENABLED_EVENTS);
  const flushIntervalMs = toNumber(process.env.ANALYTICS_FLUSH_INTERVAL_MS, DEFAULT_FLUSH_INTERVAL_MS, {
    min: 500,
    max: 60_000,
  });
  const maxBatchSize = toNumber(process.env.ANALYTICS_BATCH_SIZE, DEFAULT_MAX_BATCH_SIZE, {
    min: 1,
    max: 50,
  });
  const maxQueueSize = toNumber(process.env.ANALYTICS_QUEUE_SIZE, DEFAULT_MAX_QUEUE_SIZE, {
    min: 1,
    max: 200,
  });
  return {
    endpoint: DEFAULT_ENDPOINT,
    enabledEvents,
    flushIntervalMs,
    maxBatchSize,
    maxQueueSize,
  };
}

export function getAnalyticsServerConfig(): AnalyticsServerConfig {
  const enabledEvents = new Set(
    parseEnabledEvents(process.env.ANALYTICS_ENABLED_EVENTS)
  );
  const allowedOrigins = parseOrigins(process.env.ANALYTICS_ALLOWED_ORIGINS);
  const windowSeconds = toNumber(
    process.env.ANALYTICS_RATE_LIMIT_WINDOW_SECONDS,
    DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    { min: 10, max: 3600 }
  );
  const maxEvents = toNumber(process.env.ANALYTICS_RATE_LIMIT_MAX_EVENTS, DEFAULT_RATE_LIMIT_MAX_EVENTS, {
    min: 1,
    max: 10_000,
  });
  const maxEventsPerRequest = toNumber(
    process.env.ANALYTICS_MAX_EVENTS_PER_REQUEST,
    DEFAULT_MAX_EVENTS_PER_REQUEST,
    { min: 1, max: 100 }
  );
  const maxEventBytes = toNumber(
    process.env.ANALYTICS_MAX_EVENT_BYTES,
    DEFAULT_MAX_EVENT_BYTES,
    { min: 512, max: 16_384 }
  );
  return {
    endpoint: DEFAULT_ENDPOINT,
    enabledEvents,
    allowedOrigins,
    rateLimit: {
      windowSeconds,
      maxEvents,
    },
    maxEventsPerRequest,
    maxEventBytes,
  };
}
