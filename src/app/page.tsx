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
      console.error("Erro ao carregar posts:", error);
      setError(`Falha ao carregar os posts: ${(error as Error).message}`);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounce para evitar chamadas excessivas à API
  const debounce = (func: (...args: any[]) => void, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  // Função de busca com debounce
  const debouncedFetchPosts = useCallback(debounce(fetchPosts, 300), []);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch("/admin/api/check", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          throw new Error("Failed to check admin status");
        }
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };

    fetchPosts(); // Carrega todos os posts inicialmente
    checkAdminStatus();
  }, []);

  const handlePostClick = (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/posts/${postId}`);
  };

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

  const openDeleteModal = (postId: string) => {
    setPostToDelete(postId);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setPostToDelete(null);
  };

  if (typeof window === "undefined") return null;

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
