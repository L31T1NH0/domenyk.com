import { NextResponse } from "next/server";
import { getMongoDb } from "@lib/mongo";

const MIN_SESSIONS = 25;
const SECTIONS = 10;
const CAP_SECONDS = 120;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const db = await getMongoDb();
  const events = db.collection("analytics_events");

  // Conta sessões distintas com dados de atenção para este post
  const distinctSessions = await events.distinct("session", {
    name: "section_attention",
    "data.postId": postId,
  });

  if (distinctSessions.length < MIN_SESSIONS) {
    return NextResponse.json({ available: false }, { status: 200 });
  }

  // Calcula média de segundos por seção entre sessões distintas
  const rows = await events
    .aggregate<{ section: number; avgSeconds: number }>([
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
          avgSeconds: { $avg: "$sessionSeconds" },
        },
      },
      { $project: { _id: 0, section: "$_id", avgSeconds: 1 } },
      { $sort: { section: 1 } },
    ])
    .toArray();

  // Garante todos os 10 buckets
  const map = new Map(rows.map((r) => [r.section, r.avgSeconds]));
  const sections = Array.from({ length: SECTIONS }, (_, i) => ({
    section: i,
    avgSeconds: map.get(i) ?? 0,
  }));

  const totalSeconds = Math.round(
    sections.reduce((acc, s) => acc + s.avgSeconds, 0)
  );

  return NextResponse.json(
    { available: true, totalSeconds, sessions: distinctSessions.length },
    { status: 200 }
  );
}
