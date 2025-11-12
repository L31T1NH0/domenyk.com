import { promises as fs } from "fs";
import path from "path";
import type { MetadataRoute } from "next";

import { BASE_URL } from "../lib/base-url";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fallbackDate = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: fallbackDate,
      priority: 1,
    },
  ];

  const cachePath = path.join(process.cwd(), ".cache", "sitemap.json");

  try {
    const { getMongoDb } = await import("../lib/mongo");
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

    const sitemapEntries: MetadataRoute.Sitemap = [...staticEntries, ...postEntries];

    await persistCache(cachePath, sitemapEntries);

    return sitemapEntries;
  } catch (error) {
    console.error("Failed to generate sitemap from MongoDB:", error);

    const cached = await readCache(cachePath);
    if (cached.length > 0) {
      return cached;
    }

    return staticEntries;
  }
}

async function persistCache(cachePath: string, sitemapEntries: MetadataRoute.Sitemap) {
  try {
    const cacheDirectory = path.dirname(cachePath);
    await fs.mkdir(cacheDirectory, { recursive: true });
    const serializableEntries = sitemapEntries.map((entry) => ({
      ...entry,
      lastModified:
        entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified,
    }));

    await fs.writeFile(cachePath, JSON.stringify(serializableEntries), "utf-8");
  } catch (error) {
    console.error("Failed to persist sitemap cache:", error);
  }
}

async function readCache(cachePath: string): Promise<MetadataRoute.Sitemap> {
  try {
    const cached = await fs.readFile(cachePath, "utf-8");
    const parsed = JSON.parse(cached);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalizedEntries: MetadataRoute.Sitemap = [];

    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const url = typeof entry.url === "string" ? entry.url : undefined;
      if (!url) {
        continue;
      }

      const lastModifiedValue =
        "lastModified" in entry && typeof entry.lastModified === "string"
          ? new Date(entry.lastModified)
          : undefined;

      const normalizedLastModified =
        lastModifiedValue && !Number.isNaN(lastModifiedValue.getTime())
          ? lastModifiedValue
          : undefined;

      normalizedEntries.push({
        url,
        lastModified: normalizedLastModified,
        changeFrequency:
          typeof entry.changeFrequency === "string"
            ? entry.changeFrequency
            : undefined,
        priority: typeof entry.priority === "number" ? entry.priority : undefined,
      });
    }

    return normalizedEntries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to read sitemap cache:", error);
    }
    return [];
  }
}
