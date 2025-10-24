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

export const revalidate = 60;

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
  hidden?: boolean;
};

type PostPageProps = {
  params: Promise<{ id: string }>;
};

const loadPostById = unstable_cache(
  async (id: string) => {
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
            hidden: 1,
          },
        }
      );
    } catch (error) {
      console.error(`Failed to fetch post ${id}:`, error);
      return null;
    }
  },
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

  const title = post.title ?? "";
  const date = normalizeDate(post.date);
  const url = `https://domenyk.com/posts/${id}`;

  return {
    title: `${title} - Blog`,
    description: title,
    openGraph: {
      title,
      description: title,
      url,
    },
    twitter: {
      site: "@l31t1",
      card: "summary_large_image",
    },
    other: {
      "article:published_time": date,
      "article:modified_time": date,
    },
  };
}

export async function generateStaticParams() {
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

  if ((post as any).hidden === true) {
    notFound();
  }

  const title = post.title ?? "";
  const markdownSource = post.htmlContent ?? post.content ?? "";
  const processedContent = await remark().use(html).process(markdownSource);
  const htmlContent = processedContent.toString();
  const readingTime = calculateReadingTime(htmlContent);
  const dateString = normalizeDate(post.date);
  const views = typeof post.views === "number" ? post.views : 0;
  const path = `/posts/${post.postId}`;

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
      />
      <PostContentClient
        postId={post.postId}
        date={dateString}
        htmlContent={htmlContent}
        initialViews={views}
        audioUrl={post.audioUrl}
        readingTime={readingTime}
      />
      <BackHome />
      <Comment postId={post.postId} />
    </Layout>
  );
}
