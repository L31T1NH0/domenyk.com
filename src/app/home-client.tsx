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
  { label: "Views (menor a maior)", value: { sort: "views" as const, order: "asc" as const } },
  { label: "Views (maior a menor)", value: { sort: "views" as const, order: "desc" as const } },
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
                  type="button"
                  aria-label="Ordenar"
                  aria-haspopup="listbox"
                  aria-expanded={openSort}
                  onClick={() => setOpenSort((v) => !v)}
                  className={`card-surface inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/40 dark:text-zinc-200 ${
                    openSort ? "ring-2 ring-purple-400/40" : ""
                  }`}
                >
                  <span className="hidden whitespace-nowrap sm:inline">{currentSortLabel}</span>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-zinc-500 transition-transform duration-200 dark:text-zinc-300 ${
                      openSort ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>
                {openSort && (
                  <div
                    role="listbox"
                    className="card-surface absolute right-0 z-20 mt-2 w-64 max-h-[200px] overflow-auto p-2 shadow-lg"
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
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/40 ${
                            selected
                              ? "bg-purple-500/10 font-semibold text-purple-600 dark:bg-purple-500/20 dark:text-purple-200"
                              : "text-zinc-600 hover:bg-zinc-100/70 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
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
        <div className="card-surface border-red-400/40 bg-red-100/40 p-4 text-sm text-red-600 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : posts.length === 0 ? (
        <div className="card-surface bg-white/60 p-4 text-sm text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-300">
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
              <small className="text-zinc-600 dark:text-zinc-300">
                <Date dateString={post.date} /> <span aria-hidden className="mx-2">&middot;</span>
                <span className="inline-flex items-center rounded px-2 py-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {post.views ?? 0} views
                </span>
              </small>
              {isAdmin && (
                <button
                  onClick={() => openDeleteModal(post.postId)}
                  aria-label={`Apagar ${post.title}`}
                  title={`Apagar ${post.title}`}
                  className="absolute right-0 top-0 text-red-600 hover:text-red-700 text-sm opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 px-4"
          onClick={closeDeleteModal}
        >
          <div
            className="card-surface max-w-sm w-full space-y-6 p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Confirmar Exclusão
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Tem certeza que deseja apagar o post "
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {posts.find((p) => p.postId === postToDelete)?.title ||
                  "Este post"}
              </span>
              "?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={closeDeleteModal} className="btn-ghost">
                Cancelar
              </button>
              <button
                onClick={() => handleDeletePost(postToDelete)}
                className="btn-primary bg-red-600 hover:bg-red-500 focus-visible:ring-red-500 focus-visible:ring-offset-2"
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



















