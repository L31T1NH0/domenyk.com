import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getMongoDb } from "../../../../lib/mongo";
import { resolveAdminStatus } from "../../../../lib/admin";

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

    revalidatePath(`/posts/${postId}`);
    revalidatePath("/admin");

    return NextResponse.json({ message: "Parágrafo atualizado", postId, enabled: enabledRaw }, { status: 200 });
  } catch (error) {
    console.error("Error updating paragraph comments flag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
