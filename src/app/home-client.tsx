"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import Skeleton from "react-loading-skeleton";
import { TrashIcon } from "@heroicons/react/24/solid";
import SearchBar from "@components/SearchBar";
import { Date } from "@components/date";

export type PostData = {
  postId: string;
  title: string;
  date: string;
  views: number;
  tags: string[];
};

type HomeClientProps = {
  initialPosts: PostData[];
  isAdmin: boolean;
};

const fetcher = async (url: string): Promise<PostData[]> => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Não foi possível carregar os posts: ${response.status} - ${errorText}`
    );
  }

  const posts = await response.json();
  return Array.isArray(posts) ? posts : [];
};

export default function HomeClient({ initialPosts, isAdmin }: HomeClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const mountedRef = useRef(false);
  const lastErrorSource = useRef<"search" | "action" | null>(null);

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const searchKey = useMemo(
    () => `/api/search-posts?query=${encodeURIComponent(debouncedTerm)}`,
    [debouncedTerm]
  );

  const {
    data,
    error: swrError,
    isValidating,
    mutate,
  } = useSWR<PostData[]>(searchKey, fetcher, {
    fallbackData: initialPosts,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  useEffect(() => {
    if (swrError) {
      lastErrorSource.current = "search";
      setError(swrError.message);
    } else if (lastErrorSource.current === "search") {
      lastErrorSource.current = null;
      setError(null);
    }
  }, [swrError]);

  const posts = data ?? [];
  const showLoading = mountedRef.current && isValidating && posts.length === 0;

  const handleSearch = (query: string) => {
    if (error && lastErrorSource.current === "action") {
      lastErrorSource.current = null;
      setError(null);
    }
    setSearchTerm(query);
  };

  const openDeleteModal = (postId: string) => {
    if (!isAdmin) return;
    setPostToDelete(postId);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setPostToDelete(null);
  };

  const handleDeletePost = async (postId: string) => {
    if (!isAdmin) return;
    try {
      lastErrorSource.current = null;
      setError(null);
      const response = await fetch("/staff/deletePost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete post: ${errorText}`);
      }

      await mutate((current) => {
        const next = (current ?? []).filter(
          (post) => post.postId !== postId
        );
        return next.length === 0 ? [] : next;
      }, false);
      await mutate();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete post";
      lastErrorSource.current = "action";
      setError(message);
    } finally {
      closeDeleteModal();
    }
  };

  return (
    <section className="flex-1 gap-4">
      <div className="flex items-center gap-4 mb-4">
        <h1 className="font-bold text-2xl">Blog</h1>
        <SearchBar onSearch={handleSearch} />
      </div>
      {showLoading ? (
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
      ) : posts.length === 0 ? (
        <p className="text-sm text-zinc-400">Nenhum post encontrado.</p>
      ) : (
        <ul className="text-xl ml-0 flex flex-col gap-4">
          {posts.map((post) => (
            <li key={post.postId} className="flex flex-col mb-1 group relative">
              <Link
                href={`/posts/${post.postId}`}
                className="text-xl hover:underline"
              >
                {post.title}
              </Link>
              <small className="text-zinc-400">
                <Date dateString={post.date} /> •{" "}
                <span className="text-sm text-zinc-500 p-1">
                  {post.views ?? 0} views
                </span>
              </small>
              {isAdmin && (
                <button
                  onClick={() => openDeleteModal(post.postId)}
                  className="absolute right-0 top-0 text-red-500 hover:text-red-700 text-sm opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity duration-200"
                >
                  <TrashIcon className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showDeleteModal && postToDelete && isAdmin && (
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
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 border border-gray-300 transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletePost(postToDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 border border-red-700 transition-colors duration-200"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
