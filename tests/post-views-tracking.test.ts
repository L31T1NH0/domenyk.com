import assert from "node:assert/strict";
import { test } from "node:test";
import type { GetPostDependencies } from "../src/app/api/posts/[id]/route";

const routeModulePromise = (async () => {
  process.env.MONGODB_URI =
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/test";
  process.env.MONGODB_DB = process.env.MONGODB_DB ?? "blog";

  const globalAny = globalThis as typeof globalThis & {
    _mongoClientPromise?: Promise<{ db: () => never }>;
  };

  if (!globalAny._mongoClientPromise) {
    globalAny._mongoClientPromise = Promise.resolve({
      db() {
        throw new Error("Default Mongo client should not be used in tests");
      },
    });
  }

  return import("../src/app/api/posts/[id]/route");
})();

type ViewerRecord = {
  postId: string;
  viewerId: string;
  createdAt: Date;
  lastViewedAt: Date;
};

type MockOptions = {
  postId: string;
  initialViews?: number;
  userId?: string | null;
  existingViewerIds?: string[];
  hidden?: boolean;
};

type MockEnvironment = {
  dependencies: GetPostDependencies;
  post: { postId: string; views: number; hidden?: boolean };
  viewerRecords: Map<string, ViewerRecord>;
};

async function invokeHandler(
  req: Request,
  params: { id: string },
  dependencies: GetPostDependencies
) {
  const module = await routeModulePromise;
  return module.resolvePostResponse(req, params, dependencies);
}

function createMockEnvironment(options: MockOptions): MockEnvironment {
  const {
    postId,
    initialViews = 0,
    userId = null,
    existingViewerIds = [],
    hidden = false,
  } = options;

  const viewerRecords = new Map<string, ViewerRecord>();

  for (const viewerId of existingViewerIds) {
    viewerRecords.set(`${postId}:${viewerId}`, {
      postId,
      viewerId,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      lastViewedAt: new Date("2024-01-02T00:00:00.000Z"),
    });
  }

  const post = { postId, views: initialViews, hidden } as const;
  const mutablePost = { ...post };

  const postsCollection = {
    async findOne(query: { postId: string }) {
      if (query.postId === postId) {
        return { ...mutablePost };
      }
      return null;
    },
    async updateOne(
      query: { postId: string },
      update: { $inc?: { views?: number } }
    ) {
      if (query.postId !== postId) {
        return { acknowledged: false };
      }
      const increment = update.$inc?.views ?? 0;
      mutablePost.views += increment;
      return { acknowledged: true, matchedCount: 1, modifiedCount: increment ? 1 : 0 };
    },
  };

  const postViewsCollection = {
    async updateOne(
      filter: { postId: string; viewerId: string },
      update: {
        $setOnInsert: { postId: string; viewerId: string; createdAt: Date };
        $set: { lastViewedAt: Date };
      },
      options: { upsert?: boolean }
    ) {
      const key = `${filter.postId}:${filter.viewerId}`;
      const existing = viewerRecords.get(key);
      if (!existing) {
        if (options?.upsert) {
          const record: ViewerRecord = {
            postId: filter.postId,
            viewerId: filter.viewerId,
            createdAt: update.$setOnInsert.createdAt,
            lastViewedAt: update.$set.lastViewedAt,
          };
          viewerRecords.set(key, record);
          return { acknowledged: true, upsertedCount: 1, matchedCount: 0 };
        }
        return { acknowledged: true, upsertedCount: 0, matchedCount: 0 };
      }

      existing.lastViewedAt = update.$set.lastViewedAt;
      viewerRecords.set(key, existing);
      return { acknowledged: true, upsertedCount: 0, matchedCount: 1 };
    },
  };

  const db = {
    collection(name: string) {
      if (name === "posts") {
        return postsCollection;
      }
      if (name === "postViews") {
        return postViewsCollection;
      }
      throw new Error(`Unknown collection: ${name}`);
    },
  };

  const fakeClient = {
    db() {
      return db;
    },
  };

  const dependencies: GetPostDependencies = {
    clientPromise: Promise.resolve(fakeClient) as unknown as GetPostDependencies["clientPromise"],
    resolveAdminStatus: async () => ({ isAdmin: false, userId }),
    now: () => new Date("2024-03-01T00:00:00.000Z"),
  };

  return {
    dependencies,
    post: mutablePost,
    viewerRecords,
  };
}

function createRequest(postId: string, cookie?: string): Request {
  const headers = new Headers();
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new Request(`https://example.com/api/posts/${postId}`, { headers });
}

test("first-time authenticated viewer increments views and records view", async () => {
  const postId = "abc123";
  const { dependencies, post } = createMockEnvironment({
    postId,
    initialViews: 10,
    userId: "user-1",
  });

  const response = await invokeHandler(
    createRequest(postId),
    { id: postId },
    dependencies
  );

  const data = (await response.json()) as { views: number };
  assert.equal(data.views, 11);
  assert.equal(post.views, 11);
  assert.ok(response.headers.get("set-cookie")?.includes(`viewed_${postId}=true`));
});

test("repeat authenticated viewer without cookie does not increment views but refreshes cookie", async () => {
  const postId = "abc456";
  const { dependencies, post } = createMockEnvironment({
    postId,
    initialViews: 7,
    userId: "user-2",
    existingViewerIds: ["user-2"],
  });

  const response = await invokeHandler(
    createRequest(postId),
    { id: postId },
    dependencies
  );

  const data = (await response.json()) as { views: number };
  assert.equal(data.views, 7);
  assert.equal(post.views, 7);
  assert.ok(response.headers.get("set-cookie")?.includes(`viewed_${postId}=true`));
});

test("anonymous visitor increments views when cookie is absent", async () => {
  const postId = "anon789";
  const { dependencies, post } = createMockEnvironment({
    postId,
    initialViews: 3,
    userId: null,
  });

  const response = await invokeHandler(
    createRequest(postId),
    { id: postId },
    dependencies
  );

  const data = (await response.json()) as { views: number };
  assert.equal(data.views, 4);
  assert.equal(post.views, 4);
  assert.ok(response.headers.get("set-cookie")?.includes(`viewed_${postId}=true`));
});
