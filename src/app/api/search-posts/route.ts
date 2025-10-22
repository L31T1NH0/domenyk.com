import { NextResponse } from "next/server";
import { getMongoDb } from "../../../lib/mongo";

const PROJECTION = {
  _id: 0,
  postId: 1,
  title: 1,
  date: 1,
  views: 1,
  tags: 1,
};

const SEARCH_COLLATION = { locale: "pt", strength: 2 } as const;

type RawPost = {
  postId?: string;
  title?: string;
  date?: string | Date;
  views?: number;
  tags?: string[];
  score?: number;
};

type PostResponse = {
  postId: string;
  title: string;
  date: string;
  views: number;
  tags: string[];
};

function normalizePost(post: RawPost): PostResponse {
  return {
    postId: String(post.postId ?? ""),
    title: String(post.title ?? ""),
    date:
      typeof post.date === "string"
        ? post.date
        : post.date instanceof Date
        ? post.date.toISOString()
        : "",
    views: typeof post.views === "number" ? post.views : 0,
    tags: Array.isArray(post.tags) ? post.tags : [],
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim() ?? "";

    const db = await getMongoDb();
    const postsCollection = db.collection<RawPost>("posts");

    let posts: RawPost[] = [];

    if (query === "") {
      posts = await postsCollection
        .find({}, { projection: PROJECTION })
        .sort({ date: -1 })
        .limit(10)
        .toArray();
    } else {
      posts = await postsCollection
        .find(
          { $text: { $search: query } },
          {
            projection: {
              ...PROJECTION,
              score: { $meta: "textScore" },
            },
          }
        )
        .collation(SEARCH_COLLATION)
        .sort({ score: { $meta: "textScore" }, date: -1 })
        .limit(10)
        .toArray();

      if (posts.length === 0) {
        posts = await postsCollection
          .find(
            {
              $or: [
                { title: { $regex: query, $options: "i" } },
                { tags: { $in: [new RegExp(query, "i")] } },
              ],
            },
            { projection: PROJECTION }
          )
          .collation(SEARCH_COLLATION)
          .sort({ date: -1 })
          .limit(10)
          .toArray();
      }
    }

    const normalized = posts.map(normalizePost);

    return NextResponse.json(normalized, {
      status: 200,
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("Error searching posts:", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Internal server error: " + (error as Error).message },
      { status: 500 }
    );
  }
}
