import { promises as fs } from "fs";
import path from "path";

import { BASE_URL } from "./base-url";
import { getMongoDb } from "./mongo";

type RawPost = {
  _id?: unknown;
  slug?: string;
  postId?: string;
  title?: string;
  date?: string | Date;
  updatedAt?: string | Date;
  audioUrl?: string | null;
  tags?: string[];
  cape?: string | null;
  friendImage?: string | null;
  hidden?: boolean;
};

type PostForSitemap = {
  postId: string;
  title: string;
  lastModified: Date;
  thumbnailUrl: string | null;
  audioUrl: string | null;
  tags: string[];
};

type TagEntry = {
  slug: string;
  lastModified: Date;
};

const PUBLIC_DIR = path.join(process.cwd(), "public");
const SITEMAPS_DIR = path.join(PUBLIC_DIR, "sitemaps");

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function resolveThumbnail(raw: RawPost): string | null {
  if (typeof raw.cape === "string" && raw.cape.trim() !== "") {
    return raw.cape;
  }

  if (typeof raw.friendImage === "string" && raw.friendImage.trim() !== "") {
    return raw.friendImage;
  }

  return null;
}

function normalizePost(raw: RawPost): PostForSitemap | null {
  const id = raw.postId ?? raw.slug ?? raw._id;

  if (!id) {
    console.warn("[sitemap] skipping post without id: %s", JSON.stringify(raw));
    return null;
  }

  const lastModified =
    toDate(raw.updatedAt) ??
    (typeof raw.date === "string" ? new Date(`${raw.date}T00:00:00.000Z`) : toDate(raw.date)) ??
    new Date();

  return {
    postId: String(id),
    title: raw.title ? String(raw.title) : "",
    lastModified,
    thumbnailUrl: resolveThumbnail(raw),
    audioUrl:
      typeof raw.audioUrl === "string" && raw.audioUrl.trim() !== ""
        ? raw.audioUrl.trim()
        : null,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === "string") : [],
  };
}

async function fetchPublicPosts(): Promise<PostForSitemap[]> {
  const db = await getMongoDb();
  const collection = db.collection<RawPost>("posts");

  const posts = await collection
    .find({ hidden: { $ne: true } }, {
      projection: {
        _id: 1,
        postId: 1,
        title: 1,
        date: 1,
        updatedAt: 1,
        audioUrl: 1,
        tags: 1,
        cape: 1,
        friendImage: 1,
        hidden: 1,
      },
    })
    .sort({ date: -1 })
    .toArray();

  if (posts.length === 0) {
    console.error(`[sitemap] no posts returned from DB query (count: ${posts.length})`);
  }

  console.log(`[sitemap] raw posts from DB: ${posts.length}`);

  const normalized = posts
    .filter((raw) => raw.hidden !== true)
    .map(normalizePost)
    .filter((post): post is PostForSitemap => Boolean(post?.postId));

  if (normalized.length === 0) {
    console.warn(
      `[sitemap] no public posts available for sitemap after normalization (count: ${normalized.length})`,
    );
  }

  return normalized;
}

function changefreqForPost(lastModified: Date): "weekly" | "monthly" {
  const now = Date.now();
  const daysSinceLastMod = (now - lastModified.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLastMod < 60 ? "weekly" : "monthly";
}

function createPostsXml(posts: PostForSitemap[]): string {
  const urls = posts.map((post) => {
    const changefreq = changefreqForPost(post.lastModified);
    const postSlug = encodeURIComponent(post.postId);
    const imageBlock =
      post.thumbnailUrl !== null
        ? [`  <image:image>`, `    <image:loc>${escapeXml(post.thumbnailUrl)}</image:loc>`, `  </image:image>`]
        : [];

    return [
      `<url>`,
      `  <loc>${BASE_URL}/posts/${postSlug}</loc>`,
      `  <lastmod>${post.lastModified.toISOString()}</lastmod>`,
      `  <changefreq>${changefreq}</changefreq>`,
      `  <priority>0.8</priority>`,
      ...imageBlock,
      `</url>`,
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    '</urlset>',
  ].join("\n");
}

function createPostsAudioXml(posts: PostForSitemap[]): string {
  const audioPosts = posts.filter((post) => Boolean(post.audioUrl));

  const urls = audioPosts.map((post) => {
    const postSlug = encodeURIComponent(post.postId);
    const imageBlock =
      post.thumbnailUrl !== null
        ? [`  <image:image>`, `    <image:loc>${escapeXml(post.thumbnailUrl)}</image:loc>`, `  </image:image>`]
        : [];

    const videoBlock = [
      `  <video:video>`,
      `    <video:content_loc>${escapeXml(post.audioUrl ?? "")}</video:content_loc>`,
      `    <video:title>${escapeXml(post.title)}</video:title>`,
      `  </video:video>`,
    ];

    return [
      `<url>`,
      `  <loc>${BASE_URL}/posts/${postSlug}</loc>`,
      `  <lastmod>${post.lastModified.toISOString()}</lastmod>`,
      `  <changefreq>weekly</changefreq>`,
      `  <priority>0.8</priority>`,
      ...imageBlock,
      ...videoBlock,
      `</url>`,
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
    ...urls,
    '</urlset>',
  ].join("\n");
}

function createTagsXml(tags: TagEntry[]): string {
  const urls = tags.map((tag) => {
    const slug = encodeURIComponent(tag.slug);
    return [
      `<url>`,
      `  <loc>${BASE_URL}/tags/${slug}</loc>`,
      `  <lastmod>${tag.lastModified.toISOString()}</lastmod>`,
      `  <changefreq>monthly</changefreq>`,
      `  <priority>0.7</priority>`,
      `</url>`,
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join("\n");
}

function createSitemapIndexXml(): string {
  const urls = [
    `${BASE_URL}/sitemaps/posts.xml`,
    `${BASE_URL}/sitemaps/posts-audio.xml`,
    `${BASE_URL}/sitemaps/tags.xml`,
  ];

  const entries = urls.map((url) => [`  <sitemap>`, `    <loc>${url}</loc>`, `  </sitemap>`].join("\n"));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</sitemapindex>',
  ].join("\n");
}

function extractTagEntries(posts: PostForSitemap[]): TagEntry[] {
  const tagMap = new Map<string, Date>();

  for (const post of posts) {
    for (const tag of post.tags) {
      const normalized = String(tag).trim().toLowerCase();
      if (!normalized) continue;

      const existing = tagMap.get(normalized);
      if (!existing || existing.getTime() < post.lastModified.getTime()) {
        tagMap.set(normalized, post.lastModified);
      }
    }
  }

  return Array.from(tagMap.entries()).map(([slug, lastModified]) => ({ slug, lastModified }));
}

async function writeSitemap(filename: string, contents: string) {
  const targetDir = filename.includes("/") ? path.dirname(filename) : PUBLIC_DIR;
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(filename, contents, "utf-8");
}

// Centralized generator that builds the index and every sub-sitemap, persisting
// them under /public (and /public/sitemaps) so they can be served statically.
export async function generateAllSitemaps() {
  const posts = await fetchPublicPosts();
  const tags = extractTagEntries(posts);

  const [indexXml, postsXml, postsAudioXml, tagsXml] = [
    createSitemapIndexXml(),
    createPostsXml(posts),
    createPostsAudioXml(posts),
    createTagsXml(tags),
  ];

  await Promise.all([
    writeSitemap(path.join(PUBLIC_DIR, "sitemap.xml"), indexXml),
    writeSitemap(path.join(SITEMAPS_DIR, "posts.xml"), postsXml),
    writeSitemap(path.join(SITEMAPS_DIR, "posts-audio.xml"), postsAudioXml),
    writeSitemap(path.join(SITEMAPS_DIR, "tags.xml"), tagsXml),
  ]);

  return { indexXml, postsXml, postsAudioXml, tagsXml };
}

async function readSitemap(filename: string): Promise<string | null> {
  try {
    return await fs.readFile(filename, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to read sitemap from disk", error);
    }
    return null;
  }
}

export async function readOrGenerateSitemap(kind: "index" | "posts" | "posts-audio" | "tags") {
  const filenames: Record<"index" | "posts" | "posts-audio" | "tags", string> = {
    index: path.join(PUBLIC_DIR, "sitemap.xml"),
    posts: path.join(SITEMAPS_DIR, "posts.xml"),
    "posts-audio": path.join(SITEMAPS_DIR, "posts-audio.xml"),
    tags: path.join(SITEMAPS_DIR, "tags.xml"),
  } as const;

  try {
    const generated = await generateAllSitemaps();
    const value =
      {
        index: generated.indexXml,
        posts: generated.postsXml,
        "posts-audio": generated.postsAudioXml,
        tags: generated.tagsXml,
      }[kind];

    if (typeof value === "string") {
      return value;
    }
  } catch (error) {
    console.error("Failed to generate sitemap; returning fallback", error);

    const existing = await readSitemap(filenames[kind]);
    if (existing) {
      return existing;
    }

    const fallback =
      {
        index: createSitemapIndexXml(),
        posts: createPostsXml([]),
        "posts-audio": createPostsAudioXml([]),
        tags: createTagsXml([]),
      }[kind];

    try {
      await writeSitemap(filenames[kind], fallback);
    } catch (writeError) {
      console.error("Failed to persist fallback sitemap", writeError);
    }

    return fallback;
  }

  return null;
}

export async function triggerSitemapRegeneration() {
  try {
    await generateAllSitemaps();
  } catch (error) {
    console.error("Failed to regenerate sitemaps", error);
  }
}
