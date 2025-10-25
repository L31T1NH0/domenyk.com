import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clientPromise } from "../../../../lib/mongo";
import { Redis } from "@upstash/redis";

// Redis instance (for counting replies)
const redis = Redis.fromEnv();

export async function GET(req: Request) {
  const { sessionClaims } = await auth();
  if (sessionClaims?.metadata?.role !== "admin") {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get("limit") || "5", 10) || 5));
    const sort = (url.searchParams.get("sort") || "date") as "date" | "views" | "status";
    const order = (url.searchParams.get("order") || "desc") as "asc" | "desc";

    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

    const projection = { _id: 0, postId: 1, title: 1, date: 1, views: 1, hidden: 1, tags: 1, categories: 1 } as const;

    // Build sort doc
    let sortDoc: Record<string, 1 | -1> = { date: -1 };
    const dir: 1 | -1 = order === "asc" ? 1 : -1;
    if (sort === "views") {
      sortDoc = { views: dir };
    } else if (sort === "status") {
      // Sort by visibility (visible first if asc): hidden false(0) before true(1)
      sortDoc = { hidden: dir } as any;
    } else {
      sortDoc = { date: dir };
    }

    const [posts, total] = await Promise.all([
      postsCollection
        .find({}, { projection })
        .sort(sortDoc)
        .skip(offset)
        .limit(limit)
        .toArray(),
      postsCollection.countDocuments({}),
    ]);

    // Compute comment counts (comments + auth-comments + replies in Redis)
    const commentsCol = db.collection("comments");
    const authCommentsCol = db.collection("auth-comments");

    async function countCommentsForPost(postId: string): Promise<number> {
      // Get top-level comment ids
      const [nonAuthIds, authIds] = await Promise.all([
        commentsCol
          .find({ postId, parentId: null }, { projection: { _id: 1 } })
          .toArray(),
        authCommentsCol
          .find({ postId, parentId: null }, { projection: { _id: 1 } })
          .toArray(),
      ]);
      const totalTopLevel = nonAuthIds.length + authIds.length;
      // Count replies in Redis for each top-level comment
      const ids = [...nonAuthIds, ...authIds].map((d: any) => d._id?.toString()).filter(Boolean) as string[];
      if (ids.length === 0) return totalTopLevel;
      const replyCounts = await Promise.all(
        ids.map(async (cid) => {
          try {
            // Using ZCARD to count replies per comment
            const key = `${postId}:${cid}:replies`;
            const n = await redis.zcard(key);
            return typeof n === "number" ? n : 0;
          } catch {
            return 0;
          }
        })
      );
      const repliesTotal = replyCounts.reduce((a, b) => a + b, 0);
      return totalTopLevel + repliesTotal;
    }

    const counts = await Promise.all(
      posts.map(async (p: any) => ({ postId: p.postId, count: await countCommentsForPost(p.postId) }))
    );
    const countMap = new Map(counts.map((c) => [c.postId, c.count]));

    const enriched = posts.map((p: any) => ({
      ...p,
      commentCount: countMap.get(p.postId) ?? 0,
      tags: Array.isArray(p.tags) ? p.tags : p.tags ? [String(p.tags)] : [],
      categories: Array.isArray((p as any).categories)
        ? (p as any).categories
        : (p as any).categories
        ? [String((p as any).categories)]
        : [],
    }));

    const hasMore = offset + posts.length < total;

    return NextResponse.json({ posts: enriched, hasMore }, { status: 200 });
  } catch (error) {
    console.error("Error fetching admin posts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { sessionClaims } = await auth();
  if (sessionClaims?.metadata?.role !== "admin") {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  try {
    const { postId, tags, categories } = (await req.json()) as {
      postId?: string;
      tags?: string[] | string;
      categories?: string[] | string;
    };
    if (!postId || typeof postId !== "string") {
      return NextResponse.json(
        { error: "Post ID is required and must be a string" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

    const updateDoc: Record<string, unknown> = {};
    if (typeof tags !== "undefined") {
      const arr = Array.isArray(tags)
        ? tags
        : String(tags)
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
      updateDoc.tags = arr.slice(0, 10);
    }
    if (typeof categories !== "undefined") {
      const arr = Array.isArray(categories)
        ? categories
        : String(categories)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
      (updateDoc as any).categories = arr.slice(0, 10);
    }

    if (Object.keys(updateDoc).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const result = await postsCollection.updateOne({ postId }, { $set: updateDoc });
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Atualizado com sucesso" }, { status: 200 });
  } catch (error) {
    console.error("Error updating post meta:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

