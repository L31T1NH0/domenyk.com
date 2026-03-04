import { NextResponse } from "next/server";
import { resolveAdminStatus } from "@lib/admin";
import { getMongoDb } from "@lib/mongo";

export async function POST(req: Request) {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const postId =
    typeof (body as any)?.postId === "string" ? (body as any).postId : null;
  const pin = (body as any)?.pin;

  if (!postId || typeof pin !== "boolean") {
    return NextResponse.json(
      { error: "postId and pin (boolean) are required" },
      { status: 400 }
    );
  }

  const db = await getMongoDb();
  const posts = db.collection("posts");

  if (pin) {
    await posts.updateMany(
      { postId: { $ne: postId } },
      { $unset: { pinnedOrder: "" } }
    );

    const result = await posts.updateOne(
      { postId },
      { $set: { pinnedOrder: 0 } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
  } else {
    const result = await posts.updateOne(
      { postId },
      { $unset: { pinnedOrder: "" } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ postId, pinned: pin }, { status: 200 });
}
