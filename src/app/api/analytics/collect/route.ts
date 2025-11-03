import { NextRequest, NextResponse } from "next/server";
import type { AnyBulkWriteOperation, Db } from "mongodb";

import { getMongoDb } from "@lib/mongo";
import { resolveAdminStatus } from "@lib/admin";
import { getAnalyticsServerConfig } from "@lib/analytics/config";
import {
  ANALYTICS_SESSION_COOKIE_NAME,
  anonymizeNetworkIdentifier,
  hashSessionId,
} from "@lib/analytics/session";
import { AnalyticsEventName, isKnownEvent } from "@lib/analytics/events";
import { isLikelyBotUserAgent } from "@lib/analytics/bot";
import { consumeAnalyticsRateLimit } from "@lib/analytics/rate-limit";
import {
  ANALYTICS_COLLECTIONS,
  ensureAnalyticsIndexes,
} from "@lib/analytics/persistence";
import {
  resolveUserAgentDimensions,
  type DeviceCategory,
} from "@lib/analytics/user-agent";

const serverConfig = getAnalyticsServerConfig();

function isAllowedOrigin(req: NextRequest): boolean {
  const { allowedOrigins } = serverConfig;
  if (allowedOrigins.length === 0) {
    return true;
  }

  const origin = req.headers.get("origin");
  if (origin && allowedOrigins.includes(origin)) {
    return true;
  }

  const requestOrigin = req.nextUrl.origin;
  if (allowedOrigins.includes(requestOrigin)) {
    return true;
  }

  return false;
}

type IncomingEvent = {
  name?: unknown;
  clientTs?: unknown;
  page?: unknown;
  data?: unknown;
  device?: unknown;
};

type NormalizedEvent = {
  name: AnalyticsEventName;
  session: string;
  clientTs: Date;
  serverTs: Date;
  path: string;
  referrer?: string;
  deviceType?: DeviceCategory;
  os?: string;
  browser?: string;
  progressBucket?: number;
  ipHash?: string | null;
};

function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.slice(0, maxLength);
  }
  return undefined;
}

function sanitizeReferrer(value: unknown): string | undefined {
  const ref = sanitizeString(value, 256);
  if (!ref) {
    return undefined;
  }
  const stripped = ref.split("?")[0]?.split("#")[0] ?? ref;
  const normalized = stripped.replace(/\s+/g, "");
  if (!normalized) {
    return undefined;
  }
  return normalized;
}

function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "/";
  }

  try {
    const url = new URL(trimmed, "http://local");
    const pathCandidate = url.pathname || "/";
    return pathCandidate.slice(0, 512) || "/";
  } catch {
    const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
    const ensured = withoutQuery.startsWith("/")
      ? withoutQuery
      : `/${withoutQuery}`;
    return ensured.slice(0, 512) || "/";
  }
}

function sanitizePage(
  input: unknown,
  fallbackPath: string
): { path: string; referrer?: string } {
  const defaultPath = normalizePath(fallbackPath);
  if (!input || typeof input !== "object") {
    return { path: defaultPath };
  }

  const candidate = input as Record<string, unknown>;
  const rawPath = sanitizeString(candidate.path, 512) ?? defaultPath;
  const path = normalizePath(rawPath);
  const referrer = sanitizeReferrer(candidate.referrer);

  return { path, ...(referrer ? { referrer } : {}) };
}

function sanitizeDevice(value: unknown): DeviceCategory | undefined {
  if (value === "mobile" || value === "desktop" || value === "tablet") {
    return value;
  }
  return undefined;
}

function sanitizeProgress(
  name: AnalyticsEventName,
  data: unknown
): number | undefined {
  if (name === "read_complete") {
    return 100;
  }
  if (name !== "read_progress") {
    return undefined;
  }
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const candidate = (data as Record<string, unknown>).progress;
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    const pct = Math.round(candidate);
    if (pct >= 0 && pct <= 100) {
      return pct;
    }
  }
  if (typeof candidate === "string") {
    const numeric = Number(candidate.trim());
    if (Number.isFinite(numeric)) {
      const pct = Math.round(numeric);
      if (pct >= 0 && pct <= 100) {
        return pct;
      }
    }
  }
  return undefined;
}

function clampClientTimestamp(value: unknown, fallback: number): Date {
  if (typeof value === "number" && Number.isFinite(value)) {
    const candidate = new Date(value);
    const candidateTime = candidate.getTime();
    if (Number.isFinite(candidateTime)) {
      const now = Date.now();
      const maxFuture = now + 10 * 60 * 1000;
      const maxPast = now - 30 * 24 * 60 * 60 * 1000;
      if (candidateTime >= maxPast && candidateTime <= maxFuture) {
        return candidate;
      }
    }
  }

  return new Date(fallback);
}

function computeEventSize(event: NormalizedEvent): number {
  return Buffer.byteLength(JSON.stringify(event));
}

type ReadStateDocument = {
  session: string;
  path: string;
  progress_max: number;
  completed: boolean;
  firstAt: Date;
  lastAt: Date;
  time_active_ms: number;
  last_focus_ts: Date | null;
  in_focus: boolean;
  referrer?: string | null;
  deviceType?: DeviceCategory | null;
  os?: string | null;
  browser?: string | null;
  updatedAt: Date;
};

const STATE_KEY_DELIMITER = "\u0001";
const MAX_FOCUS_WINDOW_MS = 5 * 60 * 1000;
const HEARTBEAT_MAX_INTERVAL_MS = 45_000;
const MAX_SESSION_ACTIVE_MS = 2 * 60 * 60 * 1000;

async function persistAnalyticsEvents(
  db: Db,
  events: NormalizedEvent[]
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const eventsCollection = db.collection<NormalizedEvent>(ANALYTICS_COLLECTIONS.eventsRaw);
  await eventsCollection.insertMany(events);
  await applyReadStateUpdates(db, events);
}

function buildStateKey(session: string, path: string): string {
  return `${session}${STATE_KEY_DELIMITER}${path}`;
}

function splitStateKey(key: string): [string, string] {
  const [session, path] = key.split(STATE_KEY_DELIMITER);
  return [session ?? "", path ?? ""];
}

async function applyReadStateUpdates(
  db: Db,
  events: NormalizedEvent[]
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const grouped = new Map<string, NormalizedEvent[]>();
  for (const event of events) {
    const key = buildStateKey(event.session, event.path);
    const list = grouped.get(key);
    if (list) {
      list.push(event);
    } else {
      grouped.set(key, [event]);
    }
  }

  const readState = db.collection<ReadStateDocument>(ANALYTICS_COLLECTIONS.readState);
  const operations: AnyBulkWriteOperation<ReadStateDocument>[] = [];

  for (const [key, list] of grouped.entries()) {
    const [session, path] = splitStateKey(key);
    list.sort((a, b) => a.serverTs.getTime() - b.serverTs.getTime());

    const existing = await readState.findOne({ session, path });

    const existingProgress = typeof existing?.progress_max === "number" ? existing.progress_max : 0;
    let progressMax = existingProgress;
    let completed = existing?.completed ?? progressMax >= 100;
    let timeActive = typeof existing?.time_active_ms === "number" ? existing.time_active_ms : 0;
    let lastFocusMs = existing?.last_focus_ts ? existing.last_focus_ts.getTime() : null;
    let inFocus = existing?.in_focus ?? false;
    let firstAtMs = existing?.firstAt ? existing.firstAt.getTime() : Number.POSITIVE_INFINITY;
    let lastAtMs = existing?.lastAt ? existing.lastAt.getTime() : 0;
    let referrer = existing?.referrer ?? null;
    let deviceType = existing?.deviceType ?? null;
    let os = existing?.os ?? null;
    let browser = existing?.browser ?? null;

    const addActiveTime = (delta: number) => {
      if (delta <= 0) {
        return;
      }
      const clamped = Math.min(delta, MAX_FOCUS_WINDOW_MS);
      timeActive = Math.min(timeActive + clamped, MAX_SESSION_ACTIVE_MS);
    };

    for (const event of list) {
      const serverMs = event.serverTs.getTime();
      const clientMs = event.clientTs.getTime();
      if (serverMs < firstAtMs) {
        firstAtMs = serverMs;
      }
      if (serverMs > lastAtMs) {
        lastAtMs = serverMs;
      }

      if (!referrer && event.referrer) {
        referrer = event.referrer;
      }
      if (!deviceType && event.deviceType) {
        deviceType = event.deviceType;
      }
      if (!os && event.os) {
        os = event.os;
      }
      if (!browser && event.browser) {
        browser = event.browser;
      }

      if (
        event.progressBucket !== undefined &&
        event.progressBucket > progressMax
      ) {
        progressMax = Math.min(100, event.progressBucket);
        if (progressMax >= 100) {
          completed = true;
        }
      }

      if (event.name === "page_focus") {
        inFocus = true;
        lastFocusMs = clientMs;
      } else if (event.name === "page_blur" || event.name === "page_hide") {
        if (inFocus && lastFocusMs !== null) {
          addActiveTime(clientMs - lastFocusMs);
        }
        inFocus = false;
        lastFocusMs = null;
      } else if (event.name === "page_heartbeat") {
        if (inFocus && lastFocusMs !== null) {
          const delta = clientMs - lastFocusMs;
          if (delta > 0 && delta <= HEARTBEAT_MAX_INTERVAL_MS) {
            addActiveTime(delta);
            lastFocusMs = clientMs;
          } else if (delta > HEARTBEAT_MAX_INTERVAL_MS) {
            lastFocusMs = clientMs;
          }
        }
      }
    }

    if (!Number.isFinite(firstAtMs) || firstAtMs === Number.POSITIVE_INFINITY) {
      firstAtMs = lastAtMs || Date.now();
    }

    const updateDoc: Partial<ReadStateDocument> = {
      progress_max: progressMax,
      completed,
      firstAt: new Date(firstAtMs),
      lastAt: new Date(lastAtMs),
      time_active_ms: Math.min(Math.round(timeActive), MAX_SESSION_ACTIVE_MS),
      last_focus_ts: inFocus && lastFocusMs ? new Date(lastFocusMs) : null,
      in_focus: inFocus,
      referrer: referrer ?? null,
      deviceType: deviceType ?? null,
      os: os ?? null,
      browser: browser ?? null,
      updatedAt: new Date(),
    };

    operations.push({
      updateOne: {
        filter: { session, path },
        update: {
          $set: updateDoc,
          $setOnInsert: { session, path },
        },
        upsert: true,
      },
    });
  }

  if (operations.length > 0) {
    await readState.bulkWrite(operations, { ordered: false });
  }
}

async function parseEvents(
  req: NextRequest,
  sessionHash: string,
  userAgent: string
): Promise<NormalizedEvent[]> {
  const rawBody = await req.text();
  if (!rawBody) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return [];
  }

  let eventsInput: unknown[] = [];
  if (Array.isArray(parsed)) {
    eventsInput = parsed;
  } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).events)) {
    eventsInput = (parsed as any).events;
  }

  if (eventsInput.length === 0) {
    return [];
  }

  const sanitized: NormalizedEvent[] = [];
  const serverTs = new Date();
  const fallbackPath = req.nextUrl.pathname;
  const uaDimensions = resolveUserAgentDimensions(userAgent);

  for (const eventInput of eventsInput.slice(0, serverConfig.maxEventsPerRequest)) {
    if (!eventInput || typeof eventInput !== "object") {
      continue;
    }

    const event = eventInput as IncomingEvent;
    const name = typeof event.name === "string" ? event.name.trim() : "";
    if (!isKnownEvent(name) || !serverConfig.enabledEvents.has(name)) {
      continue;
    }

    if (
      name === "read_progress" &&
      serverConfig.readProgressSampleRate >= 0 &&
      serverConfig.readProgressSampleRate < 1 &&
      Math.random() > serverConfig.readProgressSampleRate
    ) {
      continue;
    }

    const page = sanitizePage(event.page, fallbackPath);
    const explicitDevice = sanitizeDevice(event.device);
    const deviceType = explicitDevice ?? uaDimensions.deviceType;
    const os = uaDimensions.os;
    const browser = uaDimensions.browser;
    const clientTs = clampClientTimestamp(event.clientTs, serverTs.getTime());
    const progressBucket = sanitizeProgress(name, event.data);

    const normalized: NormalizedEvent = {
      name,
      session: sessionHash,
      clientTs,
      serverTs,
      path: page.path,
      ...(page.referrer ? { referrer: page.referrer } : {}),
      ...(deviceType ? { deviceType } : {}),
      ...(os ? { os } : {}),
      ...(browser ? { browser } : {}),
      ...(progressBucket !== undefined ? { progressBucket } : {}),
    };

    const size = computeEventSize(normalized);
    if (size > serverConfig.maxEventBytes) {
      continue;
    }

    sanitized.push(normalized);
  }

  return sanitized;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAllowedOrigin(req)) {
    return new NextResponse(null, { status: 204 });
  }

  const dnt = req.headers.get("dnt") ?? req.headers.get("sec-gpc");
  if (dnt === "1") {
    return new NextResponse(null, { status: 204 });
  }

  const userAgent = req.headers.get("user-agent") ?? "";
  if (isLikelyBotUserAgent(userAgent)) {
    return new NextResponse(null, { status: 204 });
  }

  const sessionCookie = req.cookies.get(ANALYTICS_SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return new NextResponse(null, { status: 204 });
  }

  const sessionHash = hashSessionId(sessionCookie);

  const ipHash = anonymizeNetworkIdentifier((req as NextRequest & { ip?: string }).ip ?? undefined);

  const { isAdmin } = await resolveAdminStatus();
  if (isAdmin) {
    return new NextResponse(null, { status: 204 });
  }

  const events = await parseEvents(req, sessionHash, userAgent);
  if (events.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const permitted: NormalizedEvent[] = [];
  for (const event of events) {
    const limit = await consumeAnalyticsRateLimit({
      key: sessionHash,
      windowSeconds: serverConfig.rateLimit.windowSeconds,
      maxEvents: serverConfig.rateLimit.maxEvents,
    });
    if (!limit.allowed) {
      break;
    }
    permitted.push({ ...event, ipHash });
  }

  if (permitted.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const db = await getMongoDb();
    await ensureAnalyticsIndexes(db);
    await persistAnalyticsEvents(db, permitted);
  } catch (error) {
    console.error("Failed to persist analytics events", error);
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ accepted: permitted.length }, { status: 202 });
}

export const runtime = "nodejs";
