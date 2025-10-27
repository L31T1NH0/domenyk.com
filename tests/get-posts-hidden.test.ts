import assert from "node:assert/strict";
import { test } from "node:test";

type RawPost = {
  postId: string;
  title: string;
  date: string;
  views: number;
  tags: string[];
  hidden?: boolean;
};

test("admins can fetch hidden posts while non-admins cannot", async () => {
  const originalUri = process.env.MONGODB_URI;
  const originalDb = process.env.MONGODB_DB;
  const originalClientPromise = (globalThis as { _mongoClientPromise?: Promise<unknown> })
    ._mongoClientPromise;

  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  process.env.MONGODB_DB = "test-db";

  const posts: RawPost[] = [
    {
      postId: "public-post",
      title: "Public",
      date: "2024-01-01T00:00:00.000Z",
      views: 100,
      tags: ["general"],
      hidden: false,
    },
    {
      postId: "hidden-post",
      title: "Hidden",
      date: "2024-01-02T00:00:00.000Z",
      views: 5,
      tags: ["secret"],
      hidden: true,
    },
  ];

  function matchesFilter(filter: Record<string, unknown> | undefined, post: RawPost) {
    if (!filter) return true;
    const hiddenFilter = (filter as { hidden?: unknown }).hidden;
    if (typeof hiddenFilter === "undefined") return true;
    if (
      hiddenFilter &&
      typeof hiddenFilter === "object" &&
      "$ne" in (hiddenFilter as Record<string, unknown>)
    ) {
      const notValue = (hiddenFilter as { $ne?: unknown }).$ne;
      return post.hidden !== notValue;
    }
    if (typeof hiddenFilter === "boolean") {
      return Boolean(post.hidden) === hiddenFilter;
    }
    return true;
  }

  function applyProjection(post: RawPost, projection?: Record<string, number>) {
    if (!projection) {
      return { ...post };
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(projection)) {
      if (value && key in post) {
        result[key] = (post as Record<string, unknown>)[key];
      }
    }
    return result;
  }

  const fakeCollection = {
    find(filter: Record<string, unknown> | undefined, options?: { projection?: Record<string, number> }) {
      const filtered = posts.filter((post) => matchesFilter(filter, post));
      return {
        sort() {
          return {
            skip(skipCount?: number) {
              const skipped = typeof skipCount === "number" ? filtered.slice(skipCount) : filtered;
              return {
                limit(limitCount?: number) {
                  const limited = typeof limitCount === "number" ? skipped.slice(0, limitCount) : skipped;
                  return {
                    async toArray() {
                      return limited.map((post) => applyProjection(post, options?.projection));
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    async countDocuments(filter: Record<string, unknown> | undefined) {
      return posts.filter((post) => matchesFilter(filter, post)).length;
    },
  };

  const fakeDb = {
    collection(name: string) {
      if (name !== "posts") {
        throw new Error("Unexpected collection lookup: " + name);
      }
      return fakeCollection;
    },
  };

  (globalThis as { _mongoClientPromise?: Promise<unknown> })._mongoClientPromise = Promise.resolve({
    db() {
      return fakeDb;
    },
  });

  const { getPosts } = await import("../src/lib/posts");

  const visitorResult = await getPosts({ page: 1, pageSize: 10 });
  const adminResult = await getPosts({ page: 1, pageSize: 10, includeHidden: true });

  const visitorSlugs = visitorResult.posts.map((post) => post.postId);
  const adminSlugs = adminResult.posts.map((post) => post.postId);

  assert.ok(!visitorSlugs.includes("hidden-post"));
  assert.ok(adminSlugs.includes("hidden-post"));

  if (typeof originalClientPromise === "undefined") {
    delete (globalThis as { _mongoClientPromise?: Promise<unknown> })._mongoClientPromise;
  } else {
    (globalThis as { _mongoClientPromise?: Promise<unknown> })._mongoClientPromise =
      originalClientPromise;
  }

  if (typeof originalUri === "undefined") {
    delete process.env.MONGODB_URI;
  } else {
    process.env.MONGODB_URI = originalUri;
  }

  if (typeof originalDb === "undefined") {
    delete process.env.MONGODB_DB;
  } else {
    process.env.MONGODB_DB = originalDb;
  }
});
