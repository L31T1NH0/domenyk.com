"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
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
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-6 border-b border-neutral-900 pb-8">
        <div className="flex flex-col gap-2 text-neutral-400">
          <span className="text-xs uppercase tracking-[0.35em] text-neutral-500">Sessão ativa</span>
          <h2 className="text-3xl font-semibold text-neutral-100">Blog</h2>
          <p className="text-sm leading-6 text-neutral-500">
            Busque, ordene e percorra os arquivos publicados. Tudo aparece em sequência, sem ornamentos.
          </p>
        </div>
        <div className="flex flex-col gap-2">
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
                  className="inline-flex items-center gap-2 border border-neutral-800 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.4em] text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-100"
                >
                  <span className="hidden whitespace-nowrap sm:inline">{currentSortLabel}</span>
                  <ChevronDownIcon
                    className={`h-4 w-4 transition-transform duration-200 ${openSort ? "-scale-y-100" : "scale-y-100"}`}
                  />
                </button>
                {openSort && (
                  <div
                    role="listbox"
                    className="absolute right-0 z-20 mt-3 w-72 border border-neutral-800 bg-neutral-950 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
                  >
                    <ul className="flex flex-col divide-y divide-neutral-900">
                      {SORT_OPTIONS.map((opt) => {
                        const key = `${opt.value.sort ?? ""}:${opt.value.order ?? ""}`;
                        const selected = key === currentSortKey;
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => onSelectSort(key)}
                              className={`flex w-full items-center justify-between px-4 py-3 text-left text-xs uppercase tracking-[0.3em] transition-colors ${
                                selected ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-200"
                              }`}
                            >
                              {opt.label}
                              {selected && <span aria-hidden className="text-[8px] text-neutral-500">ativo</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            }
          />
          <span className="text-[11px] uppercase tracking-[0.4em] text-neutral-600">
            {posts.length} resultados na página atual
          </span>
        </div>
      </div>

      {error ? (
        <p className="rounded border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : posts.length === 0 ? (
        <div className="flex flex-col gap-1 border border-neutral-900 bg-neutral-900/40 px-6 py-8 text-sm text-neutral-400">
          <p>Nenhum registro para os filtros informados.</p>
          <p>Ajuste a busca ou retorne para a listagem completa.</p>
        </div>
      ) : (
        <ul className="border border-neutral-900">
          {posts.map((post) => (
            <li
              key={post.postId}
              className="grid gap-6 border-b border-neutral-900 px-6 py-6 transition-colors duration-200 hover:bg-neutral-900/40 md:grid-cols-[minmax(0,1fr)_200px] md:gap-10"
            >
              <div className="flex flex-col gap-4">
                <Link
                  href={`/posts/${post.postId}`}
                  className="text-2xl font-semibold leading-tight tracking-tight text-neutral-50 transition-colors hover:text-neutral-100"
                >
                  {post.title}
                </Link>
                {post.tags?.length ? (
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.35em] text-neutral-500">
                    {post.tags.map((tag) => (
                      <span key={tag} className="border border-neutral-800 px-2 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 text-xs uppercase tracking-[0.3em] text-neutral-500 md:items-end">
                <span className="text-neutral-400">
                  <Date dateString={post.date} />
                </span>
                <span className="text-neutral-500">{post.views ?? 0} leituras</span>
                {isAdmin && (
                  <button
                    onClick={() => openDeleteModal(post.postId)}
                    className="self-start border border-red-700 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.4em] text-red-400 transition-colors hover:border-red-500 hover:text-red-300 md:self-end"
                  >
                    remover
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        hasNext={hasNext}
        pathname={pathname}
        searchParams={Object.fromEntries(sp.entries())}
      />

      {showDeleteModal && postToDelete && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 px-4">
          <div className="w-full max-w-sm border border-neutral-800 bg-neutral-950 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
            <h2 className="text-lg font-semibold text-neutral-100">Confirmar exclusão</h2>
            <p className="mt-4 text-sm text-neutral-400">
              Tem certeza que deseja apagar o post
              <span className="ml-1 text-neutral-100">
                {posts.find((p) => p.postId === postToDelete)?.title || "Este post"}
              </span>
              ?
            </p>
            <div className="mt-6 flex justify-end gap-3 text-[11px] uppercase tracking-[0.4em]">
              <button
                onClick={closeDeleteModal}
                className="border border-neutral-700 px-3 py-2 text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletePost(postToDelete)}
                className="border border-red-700 px-3 py-2 text-red-400 transition-colors hover:border-red-500 hover:text-red-200"
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

