import { NextResponse } from "next/server";
import { getMongoDb } from "@lib/mongo";

const MIN_SESSIONS = 10;
const SECTIONS = 10;
const CAP_SECONDS = 120;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const db = await getMongoDb();
  const events = db.collection("analytics_events");

  const sessionCount = await events.distinct("session", {
    name: "section_attention",
    "data.postId": postId,
  });

  if (sessionCount.length < MIN_SESSIONS) {
    return NextResponse.json({ available: false }, { status: 200 });
  }

  const rows = await events
    .aggregate<{ section: number; totalSeconds: number }>([
      { $match: { name: "section_attention", "data.postId": postId } },
      {
        $group: {
          _id: { session: "$session", section: "$data.section" },
          sessionSeconds: { $sum: "$data.seconds" },
        },
      },
      {
        $project: {
          section: "$_id.section",
          sessionSeconds: { $min: ["$sessionSeconds", CAP_SECONDS] },
        },
      },
      {
        $group: {
          _id: "$section",
          totalSeconds: { $sum: "$sessionSeconds" },
        },
      },
      { $project: { _id: 0, section: "$_id", totalSeconds: 1 } },
      { $sort: { section: 1 } },
    ])
    .toArray();

  const map = new Map(rows.map((r) => [r.section, r.totalSeconds]));
  const buckets = Array.from({ length: SECTIONS }, (_, i) => ({
    section: i,
    totalSeconds: map.get(i) ?? 0,
  }));

  return NextResponse.json({ available: true, buckets }, { status: 200 });
}
