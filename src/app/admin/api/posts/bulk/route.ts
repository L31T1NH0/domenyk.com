import { NextResponse } from "next/server";
import { clientPromise } from "../../../../../lib/mongo";
import { resolveAdminStatus } from "../../../../../lib/admin";

type BulkBody =
  | { action: "visibility"; postIds: string[]; hidden: boolean }
  | { action: "delete"; postIds: string[] };

export async function POST(req: Request) {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Partial<BulkBody>;
    const { action } = body as any;
    const postIds = Array.isArray((body as any).postIds)
      ? ((body as any).postIds as unknown[]).map(String).filter(Boolean)
      : [];

    if (!action || (action !== "visibility" && action !== "delete")) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
    if (postIds.length === 0) {
      return NextResponse.json({ error: "Informe ao menos um post" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("blog");
    const posts = db.collection("posts");

    if (action === "visibility") {
      const hidden = Boolean((body as any).hidden);
      const res = await posts.updateMany({ postId: { $in: postIds } }, { $set: { hidden } });
      return NextResponse.json({ updated: res.modifiedCount }, { status: 200 });
    }

    if (action === "delete") {
      const res = await posts.deleteMany({ postId: { $in: postIds } });
      return NextResponse.json({ deleted: res.deletedCount }, { status: 200 });
    }

    return NextResponse.json({ error: "Ação não suportada" }, { status: 400 });
  } catch (error) {
    console.error("Bulk action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

