"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TrashIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import SearchBar from "@components/SearchBar";
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

const SORT_OPTIONS = [
  { label: "Data (mais antigo)", value: { sort: "date" as const, order: "asc" as const } },
  { label: "Data (mais recente)", value: { sort: "date" as const, order: "desc" as const } },
  { label: "Views (menor → maior)", value: { sort: "views" as const, order: "asc" as const } },
  { label: "Views (maior → menor)", value: { sort: "views" as const, order: "desc" as const } },
];
export default function HomeClient({ posts, isAdmin, page, hasNext }: HomeClientProps) {
  const [error, setError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const query = sp.get("query") ?? "";
  const sort = (sp.get("sort") as "date" | "views" | undefined) ?? undefined;
  const order = (sp.get("order") as "asc" | "desc" | undefined) ?? undefined;

  const [openSort, setOpenSort] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!sortRef.current) return;
      if (!sortRef.current.contains(e.target as Node)) setOpenSort(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenSort(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keyup", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keyup", onEsc);
    };
  }, []);

  const currentSortKey = `${sort ?? ""}:${order ?? ""}`;
  const currentSortLabel = (() => {
    const match = SORT_OPTIONS.find(
      (opt) => `${opt.value.sort ?? ""}:${opt.value.order ?? ""}` === currentSortKey
    );
    return match?.label ?? "Data (mais recente)";
  })();

  const onSelectSort = (key: string) => {
    const [s, o] = key.split(":");
    const next = buildUrl(
      pathname,
      sp,
      { sort: (s || undefined) as any, order: (o || undefined) as any },
      { resetPage: true }
    );
    setOpenSort(false);
    router.push(next);
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

  return (
    <section className="flex-1 gap-6">
      <div className="flex items-center flex-wrap mb-6 gap-4">
        <h1 className="font-bold text-2xl">Blog</h1>
        <div className="ml-2 sm:ml-4">
          <SearchBar
            onSearch={onSearch}
            initialQuery={query}
            rightSlot={
              <div className="relative" ref={sortRef}>
                <button
                  type="button" aria-label="Ordenar"
                  aria-haspopup="listbox"
                  aria-expanded={openSort}
                  onClick={() => setOpenSort((v) => !v)}
                  className="inline-flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
                >
                  <span className="hidden sm:inline whitespace-nowrap">{currentSortLabel}</span>
                  <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${openSort ? "rotate-180" : "rotate-0"}`} />
                </button>
                {openSort && (
                  <div
                    role="listbox"
                    className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-2 max-h-[200px] overflow-auto shadow-lg"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const key = `${opt.value.sort ?? ""}:${opt.value.order ?? ""}`;
                      const selected = key === currentSortKey;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => onSelectSort(key)}
                          className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 ${
                            selected ? "font-medium text-zinc-100" : "text-zinc-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            }
          />
        </div>
      </div>
      {error ? (
        <p className="text-red-500">{error}</p>
      ) : posts.length === 0 ? (
        <div className="text-sm text-zinc-400 space-y-2">
          <p>Nenhum post encontrado.</p>
          <p>Tente ajustar a busca ou filtros.</p>
        </div>
      ) : (
        <ul className="text-xl ml-0 flex flex-col gap-4">
          {posts.map((post) => (
            <li key={post.postId} className="flex flex-col mb-2 group relative">
              <Link
                href={`/posts/${post.postId}`}
                className="text-xl hover:underline"
              >
                {post.title}
              </Link>
              <small className="text-zinc-400">
                <Date dateString={post.date} /> <span aria-hidden className="mx-2">&middot;</span>
                <span className="inline-flex items-center rounded px-2 py-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {post.views ?? 0} views
                </span>
              </small>
              {isAdmin && (
                <button
                  onClick={() => openDeleteModal(post.postId)}
                  className="absolute right-0 top-0 text-red-500 hover:text-red-700 text-sm opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
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


















