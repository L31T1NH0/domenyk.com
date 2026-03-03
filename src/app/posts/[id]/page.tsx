import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { Layout } from "@components/layout";
import { PostHeader } from "@components/PostHeader";
import PostEditingClient from "./post-editing-client";
import { renderPostMdx } from "../../../lib/renderers/mdx";
import { resolveAdminStatus } from "../../../lib/admin";
import { renderMarkdown } from "../../../lib/renderers/markdown";
import { normalizeMarkdownContent } from "../../../lib/markdown-normalize";

function isStaticGenerationEnvironment(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export const revalidate = 60;
export const runtime = "nodejs";

type PostDocument = {
  postId: string;
  date: string | Date;
  title: string;
  subtitle?: string | null;
  contentMarkdown?: string;
  htmlContent?: string;
  content?: string;
  views?: number;
  audioUrl?: string;
  cape?: string;
  friendImage?: string;
  coAuthorUserId?: string | null;
  hidden?: boolean;
  paragraphCommentsEnabled?: boolean;
  updatedAt?: string | Date;
  tags?: string[];
};

type PostPageProps = {
  params: Promise<{ id: string }>;
};

// ---------------------------------------------------------------------------
// FIX #2: The original code called unstable_cache() *inside* loadPostById,
// creating a brand-new cache wrapper on every invocation. This defeats the
// purpose of the cache because each call registers a separate cache entry
// under a different function reference, potentially not reusing cached data
// for concurrent requests to the same post.
//
// The fix defines the cached fetcher at module level using a stable Map so
// that each unique post id gets exactly one long-lived cache wrapper that
// is reused across requests.
// ---------------------------------------------------------------------------
async function fetchPostById(id: string) {
  try {
    const { getMongoDb } = await import("../../../lib/mongo");
    const db = await getMongoDb();
    return db.collection<PostDocument>("posts").findOne(
      { postId: id },
      {
        projection: {
          _id: 0,
          postId: 1,
          date: 1,
          title: 1,
          subtitle: 1,
          contentMarkdown: 1,
          htmlContent: 1,
          content: 1,
          views: 1,
          audioUrl: 1,
          cape: 1,
          friendImage: 1,
          coAuthorUserId: 1,
          hidden: 1,
          paragraphCommentsEnabled: 1,
          tags: 1,
        },
      }
    );
  } catch (error) {
    console.error(`Failed to fetch post ${id}:`, error);
    return null;
  }
}

// Stable map of cached fetchers — one per post id, created once and reused.
const _postCacheMap = new Map<string, () => Promise<PostDocument | null>>();

function loadPostById(id: string): Promise<PostDocument | null> {
  if (!_postCacheMap.has(id)) {
    const cached = unstable_cache(
      () => fetchPostById(id),
      ["post-by-id", id],
      { revalidate: 60 }
    );
    _postCacheMap.set(id, cached);
  }
  return _postCacheMap.get(id)!();
}

function normalizeDate(date?: string | Date): string {
  if (typeof date === "string") {
    return date;
  }
  if (date instanceof Date) {
    return date.toISOString();
  }
  return "";
}

function calculateReadingTime(htmlContent: string): string {
  const wordsPerMinute = 200;
  const text = htmlContent.replace(/<[^>]+>/g, "");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / wordsPerMinute));
  return `${minutes} min`;
}

function extractPlainText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractDescription(post: PostDocument): string {
  const markdownCandidate =
    typeof post.contentMarkdown === "string"
      ? post.contentMarkdown
      : typeof post.htmlContent === "string"
        ? post.htmlContent
        : typeof post.content === "string"
          ? post.content
          : "";

  const normalizedMarkdown = normalizeMarkdownContent(markdownCandidate);

  if (normalizedMarkdown) {
    const paragraphs = normalizedMarkdown.split(/\n\s*\n/);
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) {
        continue;
      }
      const withoutLinks = trimmed
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
      const withoutFormatting = withoutLinks
        .replace(/[*_`>#~]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (withoutFormatting) {
        return withoutFormatting;
      }
    }
  }

  const htmlContent = typeof post.htmlContent === "string" ? post.htmlContent : "";
  if (htmlContent) {
    const paragraphMatch = htmlContent.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const htmlSnippet = paragraphMatch ? paragraphMatch[1] : htmlContent;
    const plain = extractPlainText(htmlSnippet);
    if (plain) {
      return plain;
    }
  }

  return post.title ?? "";
}

async function resolveIsAdmin(): Promise<boolean> {
  try {
    const { isAdmin } = await resolveAdminStatus();
    return isAdmin;
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (!id) {
    return {
      title: "Post não encontrado",
    };
  }

  const post = await loadPostById(id);

  if (!post) {
    return {
      title: "Post não encontrado",
    };
  }

  if (post.hidden === true) {
    const isAdmin = await resolveIsAdmin();
    if (!isAdmin) {
      return {
        title: "Post não encontrado",
      };
    }
  }

  const title = post.title ?? "";
  const rawSubtitle =
    typeof post.subtitle === "string" ? post.subtitle.trim() : "";
  const subtitle = rawSubtitle.length > 0 ? rawSubtitle : undefined;
  const date = normalizeDate(post.date);
  const BASE_URL = "https://domenyk.com";
  const FALLBACK_IMAGE_PATH = "/images/profile.jpg";
  const cape = typeof post.cape === "string" ? post.cape.trim() : "";
  const friendImage =
    typeof post.friendImage === "string" ? post.friendImage.trim() : "";
  const ogImage = cape || friendImage || `${BASE_URL}${FALLBACK_IMAGE_PATH}`;

  return {
    title,
    description: subtitle ?? extractDescription(post),
    openGraph: {
      title,
      description: subtitle ?? extractDescription(post),
      type: "article",
      publishedTime: date,
      url: `${BASE_URL}/posts/${id}`,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: subtitle ?? extractDescription(post),
      images: [ogImage],
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id) {
    notFound();
  }

  const [post, isAdmin] = await Promise.all([
    loadPostById(id),
    resolveIsAdmin(),
  ]);

  if (!post) {
    notFound();
  }

  if (post.hidden === true && !isAdmin) {
    notFound();
  }

  const rawContent =
    typeof post.contentMarkdown === "string"
      ? post.contentMarkdown
      : typeof post.htmlContent === "string"
        ? post.htmlContent
        : typeof post.content === "string"
          ? post.content
          : "";

  const normalizedContent = normalizeMarkdownContent(rawContent);

  let renderedHtml = "";
  let isMdx = false;

  if (!isStaticGenerationEnvironment()) {
    try {
      const mdxResult = await renderPostMdx(normalizedContent, post.postId);
      renderedHtml = mdxResult.html;
      isMdx = true;
    } catch {
      renderedHtml = await renderMarkdown(normalizedContent);
    }
  } else {
    renderedHtml = await renderMarkdown(normalizedContent);
  }

  const readingTime = calculateReadingTime(renderedHtml);
  const date = normalizeDate(post.date);

  return (
    <Layout>
      <PostEditingClient
        post={{
          postId: post.postId,
          title: post.title,
          subtitle: post.subtitle ?? null,
          date,
          views: post.views ?? 0,
          audioUrl: post.audioUrl ?? null,
          cape: post.cape ?? null,
          friendImage: post.friendImage ?? null,
          coAuthorUserId: post.coAuthorUserId ?? null,
          hidden: post.hidden ?? false,
          paragraphCommentsEnabled: post.paragraphCommentsEnabled ?? false,
          tags: post.tags ?? [],
        }}
        renderedHtml={renderedHtml}
        isMdx={isMdx}
        readingTime={readingTime}
        isAdmin={isAdmin}
      />
    </Layout>
  );
}
