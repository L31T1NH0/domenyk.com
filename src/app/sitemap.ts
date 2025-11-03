import type { MetadataRoute } from "next";

import { BASE_URL } from "../lib/base-url";
import { getMongoDb } from "../lib/mongo";

function shouldBypassDatabase(): boolean {
  return process.env.CI === "1" || process.env.NEXT_PHASE === "phase-production-build";
}

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fallbackDate = new Date();

  if (shouldBypassDatabase()) {
    return [
      {
        url: BASE_URL,
        lastModified: fallbackDate,
        priority: 1,
      },
    ];
  }

  const db = await getMongoDb();
  const postsCollection = db.collection<{ postId: string; date?: Date | string }>("posts");

  const posts = await postsCollection
    .find({ hidden: { $ne: true } }, { projection: { _id: 0, postId: 1, date: 1 } })
    .sort({ date: -1 })
    .toArray();

  const postEntries = posts
    .filter((post) => Boolean(post.postId))
    .map((post) => {
      const { postId, date } = post;
      const lastModifiedValue = date ? new Date(date) : fallbackDate;

      return {
        url: `${BASE_URL}/posts/${postId}`,
        lastModified: Number.isNaN(lastModifiedValue.getTime()) ? fallbackDate : lastModifiedValue,
        priority: 0.8,
      } satisfies MetadataRoute.Sitemap[number];
    });

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: fallbackDate,
      priority: 1,
    },
  ];

  return [...staticEntries, ...postEntries];
}
