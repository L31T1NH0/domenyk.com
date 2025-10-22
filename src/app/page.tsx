import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { Header } from "@components/header";
import { Layout } from "@components/layout";
import HomeClient, { type PostData } from "./home-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Domenyk - Blog",
  description: "Leia minhas opiniões.",
  openGraph: {
    title: "Domenyk - Blog",
    description: "Leia minhas opiniões.",
    url: "https://domenyk.com/",
  },
  twitter: {
    site: "@l31t1",
    card: "summary_large_image",
  },
};

const loadInitialPosts = unstable_cache(
  async (): Promise<PostData[]> => {
    try {
      const { getMongoDb } = await import("../lib/mongo");
      const db = await getMongoDb();
      const postsCollection = db.collection("posts");

      const posts = await postsCollection
        .find(
          {},
          {
            projection: {
              _id: 0,
              postId: 1,
              title: 1,
              date: 1,
              views: 1,
              tags: 1,
            },
          }
        )
        .sort({ date: -1 })
        .limit(10)
        .toArray();

      return posts.map((post) => ({
        postId: String(post.postId),
        title: String(post.title ?? ""),
        date:
          typeof post.date === "string"
            ? post.date
            : post.date instanceof Date
            ? post.date.toISOString()
            : "",
        views: typeof post.views === "number" ? post.views : 0,
        tags: Array.isArray(post.tags)
          ? (post.tags as string[])
          : post.tags
          ? [String(post.tags)]
          : [],
      }));
    } catch (error) {
      console.error("Failed to load initial posts on the server:", error);
      return [];
    }
  },
  ["home-initial-posts"],
  { revalidate: 60 }
);

async function resolveIsAdmin(): Promise<boolean> {
  try {
    const user = await currentUser();
    return user?.publicMetadata?.role === "admin";
  } catch (error) {
    console.error("Failed to resolve admin role on the server:", error);
    return false;
  }
}

export default async function HomePage() {
  const [initialPosts, isAdmin] = await Promise.all([
    loadInitialPosts(),
    resolveIsAdmin(),
  ]);

  return (
    <Layout home>
      <Header home={true} />
      <section className="text-xl flex flex-col gap-2 py-4 text-primary items-center">
        <h1>Dou minhas opiniões aqui</h1>
      </section>
      <HomeClient initialPosts={initialPosts} isAdmin={isAdmin} />
    </Layout>
  );
}
