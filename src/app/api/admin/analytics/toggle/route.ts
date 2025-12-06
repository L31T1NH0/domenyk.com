import { NextRequest, NextResponse } from "next/server";

import { assertAdminAccess } from "@lib/admin";
import { getAnalyticsEnabled, setAnalyticsEnabled } from "@lib/analytics/config";

async function ensureAdmin(): Promise<NextResponse | null> {
  try {
    await assertAdminAccess();
    return null;
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
}

export async function GET(): Promise<NextResponse> {
  const forbidden = await ensureAdmin();
  if (forbidden) {
    return forbidden;
  }

  const enabled = await getAnalyticsEnabled();
  return NextResponse.json({ enabled });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const forbidden = await ensureAdmin();
  if (forbidden) {
    return forbidden;
  }

  let enabled: unknown = null;
  try {
    const body = await req.json();
    enabled = body?.enabled;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  try {
    const updated = await setAnalyticsEnabled(enabled);
    return NextResponse.json({ enabled: updated });
  } catch (error) {
    console.error("Failed to update analyticsEnabled", error);
    return NextResponse.json({ error: "Failed to persist flag" }, { status: 500 });
  }
}

export const runtime = "nodejs";
