import { NextResponse } from "next/server";

import { BASE_URL } from "@lib/base-url";
import { getPosts, type PostRecord } from "@lib/posts";

type ChangeFrequency = "daily" | "weekly" | "monthly" | "yearly";

type PostWithDates = PostRecord & { lastmod: Date };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value}T00:00:00.000Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveLastmod(post: PostRecord): Date {
  return parseDate(post.updatedAt) ?? parseDate(post.date) ?? new Date();
}

function resolveChangefreq(lastmod: Date): ChangeFrequency {
  const days = (Date.now() - lastmod.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 7) return "daily";
  if (days <= 60) return "weekly";
  if (days <= 365) return "monthly";
  return "yearly";
}

function resolveThumbnail(post: PostRecord): string | null {
  const cape = typeof post.cape === "string" ? post.cape.trim() : "";
  const friendImage = typeof post.friendImage === "string" ? post.friendImage.trim() : "";
  if (cape) return cape;
  if (friendImage) return friendImage;
  return null;
}

async function fetchAllPublicPosts(): Promise<PostWithDates[]> {
  const pageSize = 100;
  let page = 1;
  const results: PostWithDates[] = [];

  while (true) {
    const { posts, hasNext } = await getPosts({
      page,
      pageSize,
      sort: "date",
      order: "desc",
      includeHidden: false,
    });

    results.push(
      ...posts
        .filter((post) => Boolean(post.postId))
        .map((post) => ({ ...post, lastmod: resolveLastmod(post) }))
    );

    if (!hasNext) {
      break;
    }

    page += 1;
  }

  return results;
}

function renderHomeUrl(lastmod: Date): string[] {
  return [
    "<url>",
    `  <loc>${BASE_URL}</loc>`,
    `  <lastmod>${lastmod.toISOString()}</lastmod>`,
    "  <changefreq>daily</changefreq>",
    "  <priority>1.0</priority>",
    "</url>",
  ];
}

function renderPostUrl(post: PostWithDates): string[] {
  const loc = `${BASE_URL}/posts/${encodeURIComponent(post.postId)}`;
  const changefreq = resolveChangefreq(post.lastmod);
  const parts = [
    "<url>",
    `  <loc>${loc}</loc>`,
    `  <lastmod>${post.lastmod.toISOString()}</lastmod>`,
    `  <changefreq>${changefreq}</changefreq>`,
    "  <priority>0.8</priority>",
  ];

  const thumbnail = resolveThumbnail(post);
  if (thumbnail) {
    parts.push("  <image:image>");
    parts.push(`    <image:loc>${escapeXml(thumbnail)}</image:loc>`);
    parts.push("  </image:image>");
  }

  if (post.audioUrl) {
    const title = post.title?.trim() || post.postId;
    parts.push("  <video:video>");
    parts.push(`    <video:content_loc>${escapeXml(post.audioUrl)}</video:content_loc>`);
    parts.push(`    <video:title>${escapeXml(title)}</video:title>`);
    parts.push("  </video:video>");
  }

  parts.push("</url>");
  return parts;
}

export async function GET() {
  const posts = await fetchAllPublicPosts();
  const mostRecentPost = posts.reduce<Date | null>((latest, post) => {
    if (!latest || post.lastmod.getTime() > latest.getTime()) {
      return post.lastmod;
    }
    return latest;
  }, null);

  const lastmodForHome = mostRecentPost ?? new Date();
  const urls: string[] = [];

  urls.push(...renderHomeUrl(lastmodForHome));
  for (const post of posts) {
    urls.push(...renderPostUrl(post));
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
    ...urls,
    "</urlset>",
  ].join("\n");

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
