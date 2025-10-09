"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NextSeo } from "next-seo";
import { Date } from "@components/date";
import { Layout } from "@components/layout";
import Skeleton from "react-loading-skeleton";
import { TrashIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import SearchBar from "@components/SearchBar";
import { Header } from "@components/header";

type PostData = {
  postId: string;
  title: string;
  date: string;
  views: number;
  tags: string[];
};

export default function Home() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  // Função para buscar posts com base na query
  const fetchPosts = async (query: string = "") => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/search-posts?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Erro ao buscar posts: ${response.status} - ${errorText}`);
        setPosts([]);
        setError(`Não foi possível carregar os posts: ${response.status} - ${errorText}`);
      } else {
        const postsData = await response.json();
        console.log("Posts recebidos da API:", postsData);
        setPosts(postsData || []);
      }
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
        <section className="flex-1 gap-4">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="font-bold text-2xl">Blog</h1>
            <SearchBar onSearch={debouncedFetchPosts} />
          </div>
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Skeleton width="80%" height={24} />
                  <div className="flex gap-2">
                    <Skeleton width={100} height={16} />
                    <Skeleton width={60} height={16} />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <ul className="text-xl ml-0 flex flex-col gap-4">
              {posts.map((post) => (
                <li
                  key={post.postId}
                  className="flex flex-col mb-1 group relative"
                >
                    <Link
                      href={`/posts/${post.postId}`}
                      onClick={(e) => handlePostClick(post.postId, e)}
                      className="text-xl hover:underline"
                    >
                      {post.title}
                    </Link>
                  <small className="text-zinc-400">
                    <Date dateString={post.date} /> •{" "}
                    <span className="text-sm text-zinc-500 p-1">
                      {post.views || 0} views
                    </span>
                  </small>
                  {isAdmin && (
                    <button
                      onClick={() => openDeleteModal(post.postId)}
                      className="absolute right-0 top-0 text-red-500 hover:text-red-700 text-sm opacity-0 
                      group-hover:opacity-100 max-sm:opacity-100 transition-opacity duration-200"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {showDeleteModal && postToDelete && (
          <div className="fixed inset-0 bg-zinc-900/90 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full border border-gray-200">
              <h2 className="text-lg font-bold mb-4 text-gray-900">
                Confirmar Exclusão
              </h2>
              <p className="mb-6 text-gray-700">
                Tem certeza que deseja apagar o post "
                <span className="font-semibold text-gray-900">
                  {posts.find((p) => p.postId === postToDelete)?.title ||
                    "Este post"}
                </span>
                "?
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={closeDeleteModal}
                  className="px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 border 
                  border-gray-300 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => postToDelete && handleDeletePost(postToDelete)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 border border-red-700 
                  transition-colors duration-200"
                >
                  Apagar
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
}