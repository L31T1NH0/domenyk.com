import { NextResponse } from "next/server";
import { resolveAdminStatus } from "@lib/admin";
import { getMongoDb } from "@lib/mongo";

export async function GET(req: Request) {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const postId = url.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const db = await getMongoDb();
  const events = db.collection("analytics_events");

  const rows = await events
    .aggregate<{ section: number; totalSeconds: number }>([
      {
        $match: {
          name: "section_attention",
          "data.postId": postId,
        },
      },
      {
        $group: {
          _id: { session: "$session", section: "$data.section" },
          sessionSeconds: { $sum: "$data.seconds" },
        },
      },
      {
        $project: {
          section: "$_id.section",
          sessionSeconds: {
            $min: ["$sessionSeconds", 120],
          },
        },
      },
      {
        $group: {
          _id: "$section",
          totalSeconds: { $sum: "$sessionSeconds" },
        },
      },
      {
        $project: { _id: 0, section: "$_id", totalSeconds: 1 },
      },
      { $sort: { section: 1 } },
    ])
    .toArray();

  return NextResponse.json(rows, { status: 200 });
}
