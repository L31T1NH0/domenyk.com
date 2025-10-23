import { unstable_cache } from "next/cache";
import { getMongoDb } from "../lib/mongo";

export type PostRecord = {
  postId: string;
  title: string;
  date: string; // ISO string
  views: number;
  tags: string[];
};

export type FetchPostsArgs = {
  page: number;
  pageSize: number;
  query?: string;
  sort?: "date" | "views";
  order?: "asc" | "desc";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: Record<string, any>;
};

export type FetchPostsResult = {
  posts: PostRecord[];
  hasNext: boolean;
  total?: number;
};

function normalizeDate(d: unknown): string {
  if (typeof d === "string") return d;
  if (d instanceof Date) return d.toISOString();
  return "";
}

export async function getPosts({
  page,
  pageSize,
  query,
  sort,
  order,
  filters,
}: FetchPostsArgs): Promise<FetchPostsResult> {
  const db = await getMongoDb();
  const collection = db.collection("posts");

  const filter: Record<string, unknown> = { ...(filters ?? {}) };

  if (query && query.trim() !== "") {
    // Prefer full-text search if an index exists; fallback to case-insensitive regex
    (filter as any).$or = [
      { $text: { $search: query } },
      { title: { $regex: query, $options: "i" } },
    ];
  }

  const sortField = sort === "views" ? "views" : "date";
  const sortOrder = order === "asc" ? 1 : -1;

  const skip = (page - 1) * pageSize;

  const projection = {
    _id: 0,
    postId: 1,
    title: 1,
    date: 1,
    views: 1,
    tags: 1,
  } as const;

  const [items, total] = await Promise.all([
    collection
      .find(filter, { projection })
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(pageSize)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  const posts: PostRecord[] = items.map((post: any) => ({
    postId: String(post.postId),
    title: String(post.title ?? ""),
    date: normalizeDate(post.date),
    views: typeof post.views === "number" ? post.views : 0,
    tags: Array.isArray(post.tags)
      ? (post.tags as string[])
      : post.tags
      ? [String(post.tags)]
      : [],
  }));

  const hasNext = page * pageSize < total;

  return { posts, hasNext, total };
}

export const getPostsCached = unstable_cache(
  async (args: FetchPostsArgs) => getPosts(args),
  ["home-posts"],
  { revalidate: 60 }
);
