import { NextRequest, NextResponse } from "next/server";

import { getMongoDb } from "@lib/mongo";
import { consumeRateLimit, getRequestIdentifier } from "@lib/rate-limit";
import { resolveUserRole, roleHasPrivilege } from "@lib/admin";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const pageSizeRaw = parseInt(searchParams.get("pageSize") || "0", 10);
  const pageSize = pageSizeRaw > 0 ? Math.min(pageSizeRaw, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  return { page, pageSize };
}

function shouldIncludeHidden(searchParams: URLSearchParams, isAdmin: boolean) {
  const includeHiddenParam = searchParams.get("includeHidden");
  return isAdmin && includeHiddenParam === "true";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { page, pageSize } = parsePagination(searchParams);
  const clientIdentifier = getRequestIdentifier(req, "anon-posts");

  const rateLimit = await consumeRateLimit({
    identifier: `posts:${clientIdentifier}`,
    windowSeconds: 60,
    maxRequests: 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const [{ role }, db] = await Promise.all([resolveUserRole(), getMongoDb()]);
    const includeHidden = shouldIncludeHidden(searchParams, roleHasPrivilege(role, "admin"));

    const filter: Record<string, unknown> = includeHidden ? {} : { hidden: { $ne: true } };
    const projection = {
      _id: 0,
      postId: 1,
      title: 1,
      date: 1,
      views: 1,
      tags: 1,
    } as const;

    const collection = db.collection("posts");

    const [items, total] = await Promise.all([
      collection
        .find(filter, { projection })
        .sort({ date: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    const posts = items.map((post: any) => ({
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
    }));

    return NextResponse.json({
      posts,
      page,
      pageSize,
      hasNext: page * pageSize < total,
      total,
    });
  } catch (error) {
    console.error("Erro ao buscar posts do MongoDB Atlas:", {
      message: (error as Error).message,
    });
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
