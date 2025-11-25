import { unstable_cache } from "next/cache";
import { getMongoDb } from "../lib/mongo";

export type PostRecord = {
  postId: string;
  title: string;
  subtitle: string | null;
  date: string; // ISO string
  views: number;
  tags: string[];
  audioUrl: string | null;
  cape: string | null;
  friendImage: string | null;
  updatedAt: string | null;
};

export type FetchPostsArgs = {
  page: number;
  pageSize: number;
  query?: string;
  sort?: "date" | "views";
  order?: "asc" | "desc";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: Record<string, any>;
  includeHidden?: boolean;
};

export type FetchPostsResult = {
  posts: PostRecord[];
  hasNext: boolean;
  total?: number;
};

export type PostReferenceMetadata = {
  postId: string;
  title: string;
  subtitle: string | null;
  date: string;
  thumbnailUrl: string | null;
};

function normalizeDate(d: unknown): string {
  if (typeof d === "string") return d;
  if (d instanceof Date) return d.toISOString();
  return "";
}

async function hasAnyTextIndex(collection: any): Promise<boolean> {
  try {
    const indexes = await collection.indexes();
    return indexes.some((idx: any) => {
      const key = idx?.key ?? {};
      return Object.values(key).some((v: any) => String(v).toLowerCase() === "text");
    });
  } catch (_e) {
    return false;
  }
}

export async function getPosts({
  page,
  pageSize,
  query,
  sort,
  order,
  filters,
  includeHidden,
}: FetchPostsArgs): Promise<FetchPostsResult> {
  const db = await getMongoDb();
  const collection = db.collection("posts");

  const baseFilter: Record<string, unknown> = { ...(filters ?? {}) };
  const shouldIncludeHidden = Boolean(includeHidden);
  if (!shouldIncludeHidden && typeof (baseFilter as any).hidden === "undefined") {
    (baseFilter as any).hidden = { $ne: true };
  }

  let filter: Record<string, unknown> = baseFilter;

  if (query && query.trim() !== "") {
    const hasText = await hasAnyTextIndex(collection);
    const searchFilter = hasText
      ? ({ $text: { $search: query, $language: "portuguese" } } as Record<string, unknown>)
      : ({ title: { $regex: query, $options: "i" } } as Record<string, unknown>);

    // Combine with baseFilter using $and to avoid $text under $or issues
    filter = { $and: [baseFilter, searchFilter] } as any;
  }

  const sortField = sort === "views" ? "views" : "date";
  const sortOrder = order === "asc" ? 1 : -1;

  const skip = (page - 1) * pageSize;

  const projection = {
    _id: 0,
    postId: 1,
    title: 1,
    subtitle: 1,
    date: 1,
    views: 1,
    tags: 1,
    audioUrl: 1,
    cape: 1,
    friendImage: 1,
    updatedAt: 1,
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
    subtitle:
      typeof post.subtitle === "string" && post.subtitle.trim() !== ""
        ? post.subtitle.trim()
        : null,
    date: normalizeDate(post.date),
    views: typeof post.views === "number" ? post.views : 0,
    tags: Array.isArray(post.tags)
      ? (post.tags as string[])
      : post.tags
      ? [String(post.tags)]
      : [],
    audioUrl:
      typeof (post as any).audioUrl === "string" && (post as any).audioUrl.trim() !== ""
        ? String((post as any).audioUrl).trim()
        : null,
    cape:
      typeof (post as any).cape === "string" && (post as any).cape.trim() !== ""
        ? String((post as any).cape).trim()
        : null,
    friendImage:
      typeof (post as any).friendImage === "string" && (post as any).friendImage.trim() !== ""
        ? String((post as any).friendImage).trim()
        : null,
    updatedAt: normalizeDate((post as any).updatedAt),
  }));

  const hasNext = page * pageSize < total;

  return { posts, hasNext, total };
}

export async function getPostsCached(args: FetchPostsArgs) {
  const cacheKey = [
    "home-posts",
    args.includeHidden ? "with-hidden" : "public",
    JSON.stringify({
      page: args.page,
      pageSize: args.pageSize,
      query: args.query ?? "",
      sort: args.sort ?? "",
      order: args.order ?? "",
      filters: args.filters ?? null,
    }),
  ];

  const cachedFetcher = unstable_cache(() => getPosts(args), cacheKey, {
    revalidate: 60,
  });

  return cachedFetcher();
}

export async function getPostReferenceMetadata(
  slug: string
): Promise<PostReferenceMetadata | null> {
  if (!slug) {
    return null;
  }

  const db = await getMongoDb();
  const collection = db.collection("posts");

  const record = await collection.findOne(
    { postId: slug },
    {
      projection: {
        _id: 0,
        postId: 1,
        title: 1,
        subtitle: 1,
        date: 1,
        cape: 1,
        friendImage: 1,
      },
    }
  );

  if (!record) {
    return null;
  }

  const title = record.title ? String(record.title) : "";
  const postId = record.postId ? String(record.postId) : slug;
  const subtitle =
    typeof (record as any).subtitle === "string" && (record as any).subtitle.trim() !== ""
      ? String((record as any).subtitle).trim()
      : null;
  const date = normalizeDate(record.date);

  let thumbnailUrl: string | null = null;

  if (typeof (record as any).cape === "string" && (record as any).cape.trim() !== "") {
    thumbnailUrl = String((record as any).cape);
  } else if (
    typeof (record as any).friendImage === "string" &&
    (record as any).friendImage.trim() !== ""
  ) {
    thumbnailUrl = String((record as any).friendImage);
  }

  return {
    postId,
    title,
    subtitle,
    date,
    thumbnailUrl,
  };
}

