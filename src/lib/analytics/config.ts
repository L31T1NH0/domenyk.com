import { AnalyticsEventName, parseEnabledEvents } from "./events";

const DEFAULT_ENDPOINT = "/api/analytics/collect";
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_MAX_BATCH_SIZE = 10;
const DEFAULT_MAX_QUEUE_SIZE = 40;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_RATE_LIMIT_MAX_EVENTS = 120;
const DEFAULT_PROGRESS_SAMPLE_RATE = 1;
const DEFAULT_MAX_EVENTS_PER_REQUEST = 25;
const DEFAULT_MAX_EVENT_BYTES = 4096;

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

export type AnalyticsClientConfig = {
  endpoint: string;
  enabledEvents: AnalyticsEventName[];
  flushIntervalMs: number;
  maxBatchSize: number;
  maxQueueSize: number;
  readProgressSampleRate: number;
  readProgressMilestones: number[];
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
  readProgressSampleRate: number;
};

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
  const readProgressSampleRate = toNumber(
    process.env.ANALYTICS_PROGRESS_SAMPLE_RATE,
    DEFAULT_PROGRESS_SAMPLE_RATE,
    { min: 0, max: 1 }
  );

  const readProgressMilestones = process.env.ANALYTICS_PROGRESS_MILESTONES
    ? process.env.ANALYTICS_PROGRESS_MILESTONES
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((milestone) => Number.isFinite(milestone) && milestone > 0 && milestone <= 1)
    : [0.25, 0.5, 0.75, 1.0];

  return {
    endpoint: DEFAULT_ENDPOINT,
    enabledEvents,
    flushIntervalMs,
    maxBatchSize,
    maxQueueSize,
    readProgressSampleRate,
    readProgressMilestones,
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
  const readProgressSampleRate = toNumber(
    process.env.ANALYTICS_PROGRESS_SAMPLE_RATE,
    DEFAULT_PROGRESS_SAMPLE_RATE,
    { min: 0, max: 1 }
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
    readProgressSampleRate,
  };
}
