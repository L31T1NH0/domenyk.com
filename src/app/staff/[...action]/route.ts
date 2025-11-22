import { NextResponse } from "next/server";

import { clientPromise } from "../../../lib/mongo";
import { assertRole } from "../../../lib/admin";

type DeletePostBody = {
  postId: string;
};

const STAFF_ACTIONS = {
  deletePost: async (body: unknown) => {
    const parsed = body as DeletePostBody;
    if (!parsed || typeof parsed.postId !== "string" || parsed.postId.trim() === "") {
      return NextResponse.json(
        { error: "Post ID is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");
    const result = await postsCollection.deleteOne({ postId: parsed.postId.trim() });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Post deleted successfully", postId: parsed.postId.trim() });
  },
} satisfies Record<string, (body: unknown) => Promise<NextResponse>>;

export async function POST(req: Request, { params }: { params: Promise<{ action: string[] }> }) {
  const resolvedParams = await params;
  const [action] = resolvedParams.action || [];

  try {
    await assertRole("admin");
  } catch {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  if (!action || !(action in STAFF_ACTIONS)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const body = await req.json();
    return await STAFF_ACTIONS[action](body);
  } catch (error) {
    console.error("Error in staff action:", {
      action,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
