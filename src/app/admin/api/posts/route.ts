import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clientPromise } from "../../../../lib/mongo";

export async function GET(req: Request) {
  const { sessionClaims } = await auth();
  if (sessionClaims?.metadata?.role !== "admin") {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get("limit") || "5", 10) || 5));

    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

    const projection = { _id: 0, postId: 1, title: 1, date: 1, views: 1, hidden: 1 } as const;

    const [posts, total] = await Promise.all([
      postsCollection
        .find({}, { projection })
        .sort({ date: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      postsCollection.countDocuments({}),
    ]);

    const hasMore = offset + posts.length < total;

    return NextResponse.json({ posts, hasMore }, { status: 200 });
  } catch (error) {
    console.error("Error fetching admin posts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
