import { NextRequest, NextResponse } from "next/server";

import { getMongoDb } from "@lib/mongo";
import { refreshAnalyticsRollups } from "@lib/analytics/rollups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH_HEADER = "authorization";
const CRON_SECRET =
  process.env.ANALYTICS_CRON_SECRET || process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) {
    // Allow local development if no secret has been configured.
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers.get(AUTH_HEADER);
  if (!header) {
    return false;
  }
  const token = header.replace(/^Bearer\s+/i, "");
  return token === CRON_SECRET;
}

function getLookbackDays(): number {
  const raw = process.env.ANALYTICS_CRON_LOOKBACK_DAYS;
  if (!raw) {
    return 3;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 3;
  }
  return Math.min(30, Math.max(1, Math.floor(parsed)));
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}

async function handler(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const lookbackDays = getLookbackDays();
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - lookbackDays);

  try {
    const db = await getMongoDb();
    await refreshAnalyticsRollups(db, { from, to: now });
    return NextResponse.json({
      ok: true,
      processedFrom: from.toISOString(),
      processedTo: now.toISOString(),
      lookbackDays,
    });
  } catch (error) {
    console.error("Falha ao executar cron de analytics:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
