import { NextRequest, NextResponse } from "next/server";

import { getMongoDb } from "@lib/mongo";
import { resolveAdminStatus } from "@lib/admin";
import { getAnalyticsEnabled, getAnalyticsServerConfig } from "@lib/analytics/config";
import {
  ANALYTICS_SESSION_COOKIE_NAME,
  anonymizeNetworkIdentifier,
  hashSessionId,
} from "@lib/analytics/session";
import { AnalyticsEventName, isKnownEvent } from "@lib/analytics/events";
import { isLikelyBotUserAgent } from "@lib/analytics/bot";
import { consumeAnalyticsRateLimit } from "@lib/analytics/rate-limit";

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
  viewport?: unknown;
  flags?: unknown;
  device?: unknown;
  user?: unknown;
  clientTimeZone?: unknown;
};

type NormalizedEvent = {
  name: AnalyticsEventName;
  session: string;
  clientTs: Date;
  serverTs: Date;
  page: {
    path: string;
    search?: string;
    referrer?: string;
    title?: string;
  };
  data?: Record<string, unknown>;
  viewport?: {
    width?: number;
    height?: number;
  };
  user?: {
    id?: string;
    name?: string;
    image?: string;
  };
  clientTimeZone?: string;
  flags?: {
    isSampled?: boolean;
    isAuthenticated?: boolean;
  };
  userAgent?: string;
  origin?: string;
  ipHash?: string | null;
  device?: "mobile" | "desktop";
  version: number;
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

function sanitizePage(input: unknown, fallbackPath: string) {
  const defaultPage = {
    path: fallbackPath,
  } as {
    path: string;
    search?: string;
    referrer?: string;
    title?: string;
  };

  if (!input || typeof input !== "object") {
    return defaultPage;
  }

  const candidate = input as Record<string, unknown>;
  const path = sanitizeString(candidate.path, 512);
  const search = sanitizeString(candidate.search, 256);
  const referrer = sanitizeString(candidate.referrer, 512);
  const title = sanitizeString(candidate.title, 256);

  return {
    path: path ?? fallbackPath,
    ...(search ? { search } : {}),
    ...(referrer ? { referrer } : {}),
    ...(title ? { title } : {}),
  };
}

function sanitizeViewport(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const viewport = value as Record<string, unknown>;
  const width = viewport.width;
  const height = viewport.height;
  const sanitized: { width?: number; height?: number } = {};
  if (typeof width === "number" && Number.isFinite(width) && width > 0) {
    sanitized.width = Math.round(width);
  }
  if (typeof height === "number" && Number.isFinite(height) && height > 0) {
    sanitized.height = Math.round(height);
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeFlags(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const flags = value as Record<string, unknown>;
  const result: { isSampled?: boolean; isAuthenticated?: boolean } = {};
  if (typeof flags.isSampled === "boolean") {
    result.isSampled = flags.isSampled;
  }
  if (typeof flags.isAuthenticated === "boolean") {
    result.isAuthenticated = flags.isAuthenticated;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function sanitizeDevice(value: unknown): "mobile" | "desktop" | undefined {
  if (value === "mobile" || value === "desktop") {
    return value;
  }
  return undefined;
}

function sanitizeHttpUrl(value: unknown, maxLength: number) {
  const asString = sanitizeString(value, maxLength);
  if (!asString) {
    return undefined;
  }
  if (!/^https?:\/\//i.test(asString)) {
    return undefined;
  }
  return asString;
}

function sanitizeUserProfile(value: unknown): NormalizedEvent["user"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const user = value as Record<string, unknown>;

  const id = sanitizeString(user.id, 128);
  const name = sanitizeString(user.name, 128);
  const image = sanitizeHttpUrl(user.image, 1024);

  const sanitized: { id?: string; name?: string; image?: string } = {};
  if (id) {
    sanitized.id = id;
  }
  if (name) {
    sanitized.name = name;
  }
  if (image) {
    sanitized.image = image;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeTimeZone(value: unknown): string | undefined {
  const tz = sanitizeString(value, 128);
  if (!tz) {
    return undefined;
  }

  if (!/^[A-Za-z0-9_./+-]+$/.test(tz)) {
    return undefined;
  }

  return tz;
}

function sanitizeAdditionalData(
  value: unknown,
  depth = 0
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || depth > 2) {
    return undefined;
  }

  const input = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const keys = Object.keys(input).slice(0, 20);
  for (const key of keys) {
    const trimmedKey = key.trim().slice(0, 64);
    if (!trimmedKey || trimmedKey.startsWith("__proto__")) {
      continue;
    }
    const currentValue = input[key];
    const sanitizedValue = sanitizeValue(currentValue, depth + 1);
    if (sanitizedValue !== undefined) {
      result[trimmedKey] = sanitizedValue;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 2) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.slice(0, 256);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return undefined;
    }
    return Number(value.toFixed(6));
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth > 1) {
      return undefined;
    }
    const sanitizedArray: unknown[] = [];
    for (const item of value.slice(0, 10)) {
      const sanitizedItem = sanitizeValue(item, depth + 1);
      if (sanitizedItem !== undefined) {
        sanitizedArray.push(sanitizedItem);
      }
    }
    return sanitizedArray.length > 0 ? sanitizedArray : undefined;
  }

  if (typeof value === "object") {
    return sanitizeAdditionalData(value, depth + 1);
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

async function parseEvents(
  req: NextRequest,
  sessionHash: string,
  userAgent: string,
  origin: string | null
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

  for (const eventInput of eventsInput.slice(0, serverConfig.maxEventsPerRequest)) {
    if (!eventInput || typeof eventInput !== "object") {
      continue;
    }

    const event = eventInput as IncomingEvent;
    const name = typeof event.name === "string" ? event.name.trim() : "";
    if (!isKnownEvent(name) || !serverConfig.enabledEvents.has(name)) {
      continue;
    }

    const page = sanitizePage(event.page, fallbackPath);
    const viewport = sanitizeViewport(event.viewport);
    const flags = sanitizeFlags(event.flags);
    const device = sanitizeDevice(event.device);
    const clientTs = clampClientTimestamp(event.clientTs, serverTs.getTime());
    const additionalData = sanitizeAdditionalData(event.data);
    const user = flags?.isAuthenticated ? sanitizeUserProfile(event.user) : undefined;
    const clientTimeZone = sanitizeTimeZone(event.clientTimeZone);

    const normalized: NormalizedEvent = {
      name,
      session: sessionHash,
      clientTs,
      serverTs,
      page,
      ...(additionalData ? { data: additionalData } : {}),
      ...(viewport ? { viewport } : {}),
      ...(user ? { user } : {}),
      ...(flags ? { flags } : {}),
      ...(device ? { device } : {}),
      ...(clientTimeZone ? { clientTimeZone } : {}),
      ...(userAgent ? { userAgent: userAgent.slice(0, 256) } : {}),
      ...(origin ? { origin: origin.slice(0, 256) } : {}),
      version: 1,
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
  const analyticsEnabled = await getAnalyticsEnabled({ bypassCache: true });
  if (!analyticsEnabled) {
    return new NextResponse(null, { status: 403 });
  }

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

  const origin = req.headers.get("origin");

  const sessionHash = hashSessionId(sessionCookie);

  const ipHash = anonymizeNetworkIdentifier((req as NextRequest & { ip?: string }).ip ?? undefined);

  const { isAdmin } = await resolveAdminStatus();
  if (isAdmin) {
    return new NextResponse(null, { status: 204 });
  }

  const events = await parseEvents(req, sessionHash, userAgent, origin);
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
    await db.collection<NormalizedEvent>("analytics_events").insertMany(permitted);
  } catch (error) {
    console.error("Failed to persist analytics events", error);
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ accepted: permitted.length }, { status: 202 });
}

export const runtime = "nodejs";
