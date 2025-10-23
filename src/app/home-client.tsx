"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Skeleton from "react-loading-skeleton";
import { TrashIcon } from "@heroicons/react/24/solid";
import SearchBar from "@components/SearchBar";
import SortPicker from "@components/SortPicker";
import Pagination from "@components/Pagination";
import { Date } from "@components/date";
import { buildUrl } from "../lib/url";

export type PostData = {
  postId: string;
  title: string;
  date: string;
  views: number;
  tags: string[];
};

type HomeClientProps = {
  posts: PostData[];
  isAdmin: boolean;
  page: number;
  hasNext: boolean;
};

export default function HomeClient({ posts, isAdmin, page, hasNext }: HomeClientProps) {
  const [error, setError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const query = sp.get("query") ?? "";

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

      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete post";
      setError(message);
    } finally {
      closeDeleteModal();
    }
  };

  const onSearch = (newQuery: string) => {
    const next = buildUrl(
      pathname,
      sp,
      { query: newQuery },
      { resetPage: true }
    );
    router.push(next);
  };

  const loading = false; // streaming/loading handled by app/loading.tsx if present

  return (
    <section className="flex-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><div className="flex items-center gap-4"><h1 className="font-bold text-2xl">Blog</h1><SearchBar onSearch={onSearch} initialQuery={query} /></div><SortPicker /></div>
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
      ) : posts.length === 0 ? (
        <div className="text-sm text-zinc-400">
          <p>Nenhum post encontrado.</p>
          <p className="mt-1">Tente ajustar a busca ou filtros.</p>
        </div>
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
                <Date dateString={post.date} /> ·{" "}
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

      <Pagination page={page} hasNext={hasNext} pathname={pathname} searchParams={Object.fromEntries(sp.entries())} />

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


