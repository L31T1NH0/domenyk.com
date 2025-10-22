import { notFound } from "next/navigation";
import { NextSeo, ArticleJsonLd } from "next-seo";
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
};

type PostPageProps = {
  params: Promise<{ id: string }>;
};

async function getPostById(id: string) {
  try {
    const { getMongoDb } = await import("../../../lib/mongo");
    const db = await getMongoDb();
    const post = await db.collection<PostDocument>("posts").findOne(
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
        },
      }
    );
    return post;
  } catch (error) {
    console.error(`Failed to fetch post ${id}:`, error);
    return null;
  }
}

function calculateReadingTime(htmlContent: string): string {
  const wordsPerMinute = 200;
  const text = htmlContent.replace(/<[^>]+>/g, "");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / wordsPerMinute));
  return `${minutes} min`;
}

export async function generateStaticParams() {
  try {
    const { getMongoDb } = await import("../../../lib/mongo");
    const db = await getMongoDb();
    const posts = await db
      .collection<{ postId: string }>("posts")
      .find(
        {},
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

  const post = await getPostById(id);

  if (!post) {
    notFound();
  }

  const title = post.title ?? "";
  const markdownSource = post.htmlContent ?? post.content ?? "";
  const processedContent = await remark().use(html).process(markdownSource);
  const htmlContent = processedContent.toString();
  const readingTime = calculateReadingTime(htmlContent);
  const dateString =
    typeof post.date === "string"
      ? post.date
      : post.date instanceof Date
      ? post.date.toISOString()
      : "";
  const views = typeof post.views === "number" ? post.views : 0;
  const path = `/posts/${post.postId}`;

  return (
    <>
      <NextSeo
        title={`${title} - Blog`}
        description={title}
        openGraph={{
          title,
          description: title,
          url: `https://domenyk.com${path}`,
        }}
        twitter={{ handle: "@l31t1" }}
      />
      <ArticleJsonLd
        type="Blog"
        url={`https://domenyk.com${path}`}
        title={title}
        images={[
          "https://img.clerk.com/eyJ0eXBlIjoicHJveHkiLCJzcmMiOiJodHRwczovL2ltYWdlcy5jbGVyay5kZXYvdXBsb2FkZWQvaW1nXzJ0dHoxemhpRmFjcHdvbVFGdHNpdGhaYkk3eiJ9",
        ]}
        datePublished={dateString}
        dateModified={dateString}
        authorName="Domenyk"
        description={title}
      />
      <Layout title={title} description={title} url={path}>
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
    </>
  );
}
