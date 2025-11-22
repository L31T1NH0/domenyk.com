import { NextRequest, NextResponse } from "next/server";

import { getMongoDb } from "@lib/mongo";
import { consumeRateLimit, getRequestIdentifier } from "@lib/rate-limit";

const PROJECTION = {
  _id: 0,
  postId: 1,
  title: 1,
  date: 1,
  views: 1,
  tags: 1,
} as const;

const SEARCH_COLLATION = { locale: "pt", strength: 2 } as const;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const MAX_QUERY_LENGTH = 120;

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

function parseLimit(searchParams: URLSearchParams) {
  const raw = parseInt(searchParams.get("limit") || "0", 10);
  if (Number.isNaN(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawQuery = searchParams.get("query")?.trim() ?? "";
  const trimmedQuery = rawQuery.slice(0, MAX_QUERY_LENGTH);
  const limit = parseLimit(searchParams);
  const clientIdentifier = getRequestIdentifier(req, "anon-search");

  const rateLimit = await consumeRateLimit({
    identifier: `search:${clientIdentifier}`,
    windowSeconds: 60,
    maxRequests: 50,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const db = await getMongoDb();
    const postsCollection = db.collection<RawPost>("posts");

    let posts: RawPost[] = [];

    if (trimmedQuery === "") {
      posts = await postsCollection
        .find({ hidden: { $ne: true } }, { projection: PROJECTION })
        .sort({ date: -1 })
        .limit(limit)
        .toArray();
    } else {
      try {
        posts = await postsCollection
          .find(
            { hidden: { $ne: true }, $text: { $search: trimmedQuery } },
            {
              projection: {
                ...PROJECTION,
                score: { $meta: "textScore" },
              },
            }
          )
          .collation(SEARCH_COLLATION)
          .sort({ score: { $meta: "textScore" }, date: -1 })
          .limit(limit)
          .toArray();
      } catch (err) {
        posts = [];
      }

      if (posts.length === 0) {
        const safeQuery = escapeRegExp(trimmedQuery);
        posts = await postsCollection
          .find(
            {
              hidden: { $ne: true },
              $or: [
                { title: { $regex: safeQuery, $options: "i" } },
                { tags: { $in: [new RegExp(safeQuery, "i")] } },
              ],
            },
            { projection: PROJECTION }
          )
          .collation(SEARCH_COLLATION)
          .sort({ date: -1 })
          .limit(limit)
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
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
