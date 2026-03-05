import { type NextRequest, NextResponse } from "next/server";

import { getMongoDb } from "@lib/mongo";
import { resolveAdminStatus } from "@lib/admin";

const SETTING_KEY = "mobileHighlightStyle";

type MobileHighlightStyleSetting = {
  _id: string;
  value?: "badges" | "border";
  updatedAt?: Date;
};

export async function GET() {
  const db = await getMongoDb();
  const doc = await db
    .collection<MobileHighlightStyleSetting>("settings")
    .findOne({ _id: SETTING_KEY });
  return NextResponse.json({ value: doc?.value ?? "badges" });
}

export async function POST(req: NextRequest) {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { value } = await req.json();
  if (value !== "badges" && value !== "border") {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }

  const db = await getMongoDb();
  await db.collection<MobileHighlightStyleSetting>("settings").updateOne(
    { _id: SETTING_KEY },
    { $set: { value, updatedAt: new Date() } },
    { upsert: true }
  );

  return NextResponse.json({ value });
}
