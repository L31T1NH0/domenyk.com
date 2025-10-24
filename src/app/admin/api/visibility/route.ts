import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clientPromise } from "../../../../lib/mongo";

export async function POST(req: Request) {
  const { sessionClaims } = await auth();
  if (sessionClaims?.metadata?.role !== "admin") {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  try {
    const { postId, hidden } = (await req.json()) as { postId?: string; hidden?: boolean };
    if (!postId || typeof postId !== "string") {
      return NextResponse.json(
        { error: "Post ID is required and must be a string" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");
    const targetHidden = hidden === true;

    const result = await postsCollection.updateOne({ postId }, { $set: { hidden: targetHidden } });
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Visibility updated", postId, hidden: targetHidden }, { status: 200 });
  } catch (error) {
    console.error("Error updating visibility:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
