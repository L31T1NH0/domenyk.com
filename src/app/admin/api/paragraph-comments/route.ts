import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getMongoDb } from "../../../../lib/mongo";

export async function POST(req: Request) {
  const { sessionClaims } = await auth();
  if (sessionClaims?.metadata?.role !== "admin") {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const postId = typeof (body as any)?.postId === "string" ? (body as any).postId : null;
  const enabledRaw = (body as any)?.enabled;
  if (!postId || typeof enabledRaw !== "boolean") {
    return NextResponse.json(
      { error: "Post ID and enabled flag are required" },
      { status: 400 }
    );
  }

  try {
    const db = await getMongoDb();
    const posts = db.collection("posts");
    const result = await posts.updateOne(
      { postId },
      { $set: { paragraphCommentsEnabled: enabledRaw } }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Parágrafo atualizado", postId, enabled: enabledRaw },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating paragraph comments flag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
