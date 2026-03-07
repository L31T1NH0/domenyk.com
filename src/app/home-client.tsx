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
  pinnedOrder?: number | null;
};

type HomeClientProps = {
  posts: PostData[];
  isAdmin: boolean;
  page: number;
  hasNext: boolean;
  total?: number;
};

const SORT_OPTIONS = [
  { label: "Data (mais antigo)", value: { sort: "date" as const, order: "asc" as const } },
  { label: "Data (mais recente)", value: { sort: "date" as const, order: "desc" as const } },
  { label: "Views (menor a maior)", value: { sort: "views" as const, order: "asc" as const } },
  { label: "Views (maior a menor)", value: { sort: "views" as const, order: "desc" as const } },
];
export default function HomeClient({ posts, isAdmin, page, hasNext, total }: HomeClientProps) {
  const [error, setError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const totalCount = typeof total === "number" ? total : posts.length;

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
      <div className="mb-5 flex flex-row flex-wrap items-center gap-2 sm:mb-6 sm:gap-3">
        <h1 className="flex items-center gap-1 text-sm font-semibold text-[#f1f1f1]">
          Posts
          <span className="tabular-nums text-[#A8A095] font-normal">({totalCount})</span>
        </h1>
        <div className="w-auto">
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
        <ul className="ml-0 divide-y divide-white/8">
          {posts.map((post) => (
            <li
              key={post.postId}
              className="group relative py-5 first:pt-0"
            >
              {post.pinnedOrder != null && (
                <span className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="size-3"
                    aria-hidden="true"
                  >
                    <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/>
                  </svg>
                  Fixado
                </span>
              )}
              <Link
                href={`/posts/${post.postId}`}
                prefetch={false}
                className="flex flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-0"
              >
                <span className="text-lg font-semibold leading-snug text-[#f1f1f1]">
                  {post.title}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#A8A095]">
                    <Date dateString={post.date} />
                  </span>
                  <span aria-hidden className="text-[#A8A095]/40">·</span>
                  <span className="text-xs text-[#A8A095] tabular-nums">
                    {post.views ?? 0} views
                  </span>
                  {null}
                </div>
              </Link>
              {isAdmin && (
                <button
                  onClick={() => openDeleteModal(post.postId)}
                  aria-label={`Apagar ${post.title}`}
                  title={`Apagar ${post.title}`}
                  className="absolute right-0 top-5 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                >
                  <TrashIcon className="size-4" aria-hidden="true" />
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

















