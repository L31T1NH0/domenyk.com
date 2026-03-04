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

const getPostById = unstable_cache(
  (id: string) => fetchPostById(id),
  ["post-by-id"],
  { revalidate: 60 }
);

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

  const post = await getPostById(id);

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
    getPostById(id),
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
  if (!isStaticGenerationEnvironment()) {
    try {
      renderedHtml = await renderPostMdx(normalizedContent);
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
      <PostHeader
        cape={post.cape}
        title={post.title}
        subtitle={post.subtitle ?? undefined}
        friendImage={post.friendImage}
      />
      <PostEditingClient
        postId={post.postId}
        title={post.title}
        date={date}
        initialHtmlContent={renderedHtml}
        initialViews={post.views ?? 0}
        audioUrl={post.audioUrl}
        readingTime={readingTime}
        coAuthorUserId={post.coAuthorUserId ?? null}
        coAuthorImageUrl={post.friendImage ?? null}
        paragraphCommentsEnabled={post.paragraphCommentsEnabled ?? false}
        isAdmin={isAdmin}
        initialMarkdown={normalizedContent}
        tags={post.tags ?? []}
      />
    </Layout>
  );
}
