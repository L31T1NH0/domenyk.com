import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { Layout } from "@components/layout";
import { BackHome } from "@components/back-home";
import Comment from "@components/Comment";
import { PostHeader } from "@components/PostHeader";
import PostContentClient from "./post-content-client";
import { remark } from "remark";
import html from "remark-html";
import { renderPostMdx } from "../../../lib/renderers/mdx";
import { resolveAdminStatus } from "../../../lib/admin";

function isStaticGenerationEnvironment(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export const revalidate = 60;
export const runtime = "nodejs";

type PostDocument = {
  postId: string;
  date: string | Date;
  title: string;
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
};

type PostPageProps = {
  params: Promise<{ id: string }>;
};

// Cache per post-id to avoid cross-post cache pollution
async function fetchPostById(id: string) {
  if (process.env.CI === "1" || isStaticGenerationEnvironment()) {
    return null;
  }

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
          htmlContent: 1,
          content: 1,
          views: 1,
          audioUrl: 1,
          cape: 1,
          friendImage: 1,
          coAuthorUserId: 1,
          hidden: 1,
          paragraphCommentsEnabled: 1,
        },
      }
    );
  } catch (error) {
    console.error(`Failed to fetch post ${id}:`, error);
    return null;
  }
}

const loadPostById = (id: string) =>
  unstable_cache(
    () => fetchPostById(id),
    ["post-by-id", id],
    { revalidate: 60 }
  )();

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
  const htmlContent = typeof post.htmlContent === "string" ? post.htmlContent : "";
  if (htmlContent) {
    const paragraphMatch = htmlContent.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const htmlSnippet = paragraphMatch ? paragraphMatch[1] : htmlContent;
    const plain = extractPlainText(htmlSnippet);
    if (plain) {
      return plain;
    }
  }

  const markdownContent = typeof post.content === "string" ? post.content : "";
  if (markdownContent) {
    const paragraphs = markdownContent.split(/\n\s*\n/);
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
  const date = normalizeDate(post.date);
  const BASE_URL = "https://domenyk.com";
  const FALLBACK_IMAGE_PATH = "/images/profile.jpg";
  const cape = typeof post.cape === "string" ? post.cape.trim() : "";
  const imageSource = cape || FALLBACK_IMAGE_PATH;
  const imageUrl = new URL(imageSource, BASE_URL).toString();
  const url = `${BASE_URL}/posts/${id}`;
  const updatedAt = normalizeDate(post.updatedAt);
  const publishedTime = date || undefined;
  const modifiedTime = updatedAt || undefined;
  const description = extractDescription(post);

  const openGraph: Metadata["openGraph"] = {
    title,
    description,
    url,
    type: "article",
    images: [
      {
        url: imageUrl,
        alt: title,
      },
    ],
    siteName: "Domenyk",
    locale: "pt_BR",
  };

  if (publishedTime) {
    openGraph.publishedTime = publishedTime;
  }

  if (modifiedTime) {
    openGraph.modifiedTime = modifiedTime;
  }

  const other: NonNullable<Metadata["other"]> = {};

  if (publishedTime) {
    other["article:published_time"] = publishedTime;
  }

  const modifiedTimeForOther = modifiedTime ?? publishedTime;
  if (modifiedTimeForOther) {
    other["article:modified_time"] = modifiedTimeForOther;
  }

  return {
    title: `${title} - Blog`,
    description,
    openGraph,
    twitter: {
      site: "@l31t1",
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    ...(Object.keys(other).length ? { other } : {}),
  };
}

export async function generateStaticParams() {
  if (process.env.CI === "1" || isStaticGenerationEnvironment()) {
    return [];
  }

  try {
    const { getMongoDb } = await import("../../../lib/mongo");
    const db = await getMongoDb();
    const posts = await db
      .collection<{ postId: string }>("posts")
      .find(
        { hidden: { $ne: true } },
        {
          projection: { _id: 0, postId: 1 },
        }
      )
      .sort({ date: -1 })
      .limit(20)
      .toArray();

    return posts
      .map((post) => post.postId)
      .filter((postId): postId is string => typeof postId === "string" && postId.length > 0)
      .map((postId) => ({ id: postId }));
  } catch (error) {
    console.error("Failed to pre-generate post params:", error);
    return [];
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id) {
    notFound();
  }

  const post = await loadPostById(id);

  if (!post) {
    notFound();
  }

  const isAdmin = await resolveIsAdmin();

  if ((post as any).hidden === true && !isAdmin) {
    notFound();
  }

  const title = post.title ?? "";
  const markdownSource = post.htmlContent ?? post.content ?? "";
  const shouldUseMdxRenderer = process.env.FEATURE_MDX_RENDERER === "true";

  let htmlContent: string;

  if (shouldUseMdxRenderer) {
    try {
      htmlContent = await renderPostMdx(markdownSource);
    } catch (error) {
      console.error(`MDX renderer failed for post ${post.postId}:`, error);
      const processedContent = await remark().use(html).process(markdownSource);
      htmlContent = processedContent.toString();
    }
  } else {
    try {
      const processedContent = await remark().use(html).process(markdownSource);
      htmlContent = processedContent.toString();
    } catch (error) {
      console.error(`Markdown renderer failed for post ${post.postId}:`, error);
      htmlContent = "";
    }
  }
  const readingTime = calculateReadingTime(htmlContent);
  const dateString = normalizeDate(post.date);
  const views = typeof post.views === "number" ? post.views : 0;
  const path = `/posts/${post.postId}`;
  const paragraphCommentsEnabled = post.paragraphCommentsEnabled !== false;

  let coAuthorImageUrl: string | null = null;
  if (!isStaticGenerationEnvironment()) {
    try {
      if (post.coAuthorUserId) {
        const { getClerkServerClient } = await import("../../../lib/clerk-server");
        const client = await getClerkServerClient();
        const user = await client.users.getUser(post.coAuthorUserId);
        coAuthorImageUrl = user.imageUrl ?? null;
      }
    } catch (e) {
      coAuthorImageUrl = null;
    }
  }

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    datePublished: dateString,
    dateModified: dateString,
    author: {
      '@type': 'Person',
      name: 'Domenyk',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://domenyk.com${path}`,
    },
  };

  return (
    <Layout title={title} description={title} url={path}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <PostHeader
        cape={post.cape}
        title={title}
        friendImage={post.friendImage}
        coAuthorImageUrl={coAuthorImageUrl}
      />
      <PostContentClient
        postId={post.postId}
        date={dateString}
        htmlContent={htmlContent}
        initialViews={views}
        audioUrl={post.audioUrl}
        readingTime={readingTime}
        coAuthorUserId={post.coAuthorUserId ?? null}
        coAuthorImageUrl={coAuthorImageUrl || post.friendImage || null}
        paragraphCommentsEnabled={paragraphCommentsEnabled}
        isAdmin={isAdmin}
      />
      <BackHome />
      <Comment
        postId={post.postId}
        coAuthorUserId={post.coAuthorUserId ?? undefined}
        isAdmin={isAdmin}
      />
    </Layout>
  );
}
