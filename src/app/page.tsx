import { currentUser } from "@clerk/nextjs/server";
import { NextSeo } from "next-seo";
import { Header } from "@components/header";
import { Layout } from "@components/layout";
import HomeClient, { type PostData } from "./home-client";

async function getInitialPosts(): Promise<PostData[]> {
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
}

async function resolveIsAdmin(): Promise<boolean> {
  try {
    const user = await currentUser();
    return user?.publicMetadata?.role === "admin";
  } catch (error) {
    console.error("Failed to resolve admin role on the server:", error);
    return false;
  }
}

<<<<<<< HEAD
export const revalidate = 60;

export default async function HomePage() {
  const [initialPosts, isAdmin] = await Promise.all([
    getInitialPosts(),
    resolveIsAdmin(),
  ]);

=======
  const handleDeletePost = async (postId: string) => {
    try {
      const response = await fetch("/staff/deletePost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!response.ok) throw new Error("Failed to delete post");
      const data = await response.json();
      console.log(data.message);
      setPosts(posts.filter((post) => post.postId !== postId));
    } catch (error) {
      console.error("Error deleting post:", error);
      setError("Failed to delete post: " + (error as Error).message);
    } finally {
      setShowDeleteModal(false);
      setPostToDelete(null);
    }
  };
  
  if (typeof window === "undefined") return null;


  const openDeleteModal = (postId: string) => {
    setPostToDelete(postId);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setPostToDelete(null);
  };
>>>>>>> main
  return (
    <>
      <NextSeo
        title="Domenyk - Blog"
        description="Leia minhas opiniões."
        openGraph={{
          title: "Domenyk - Blog",
          description: "Leia minhas opiniões.",
          url: "https://domenyk.com/",
        }}
        twitter={{
          handle: "@l31t1",
          cardType: "summary_large_image",
        }}
      />
      <Layout home>
        <Header home={true} />
        <section className="text-xl flex flex-col gap-2 py-4 text-primary items-center">
          <h1>Dou minhas opiniões aqui</h1>
        </section>
        <HomeClient initialPosts={initialPosts} isAdmin={isAdmin} />
      </Layout>
    </>
  );
}
