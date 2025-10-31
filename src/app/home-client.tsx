"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TrashIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import SearchBar from "@components/SearchBar";
import Pagination from "@components/Pagination";
import { Date } from "@components/date";
import { layoutClasses } from "@components/layout";
import { useReveal } from "@lib/useReveal";
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

type SortOption = {
  label: string;
  value: { sort: "date" | "views"; order: "asc" | "desc" };
};

const SORT_OPTIONS: SortOption[] = [
  { label: "Data (mais antigo)", value: { sort: "date", order: "asc" } },
  { label: "Data (mais recente)", value: { sort: "date", order: "desc" } },
  { label: "Views (menor → maior)", value: { sort: "views", order: "asc" } },
  { label: "Views (maior → menor)", value: { sort: "views", order: "desc" } },
];

type SortKey = `${"date" | "views"}:${"asc" | "desc"}` | ":";

function buildSortKey(sort?: "date" | "views", order?: "asc" | "desc"): SortKey {
  return `${sort ?? ""}:${order ?? ""}` as SortKey;
}

type PostCardProps = {
  post: PostData;
  isAdmin: boolean;
  onDeleteRequest: (postId: string) => void;
};

function PostCard({ post, isAdmin, onDeleteRequest }: PostCardProps) {
  const cardRef = useReveal<HTMLLIElement>({ threshold: 0.2, rootMargin: "0px 0px -10%" });

  return (
    <li ref={cardRef} className="reveal-init">
      <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[rgba(22,22,22,0.7)] px-0 py-0 shadow-[0_24px_44px_rgba(0,0,0,0.38)] transition duration-300 hover:border-[rgba(255,75,139,0.35)] hover:shadow-[0_30px_54px_rgba(0,0,0,0.45)]">
        {isAdmin && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDeleteRequest(post.postId);
            }}
            className="motion-scale absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(13,13,13,0.8)] text-[var(--color-muted)] opacity-0 shadow-[0_10px_25px_rgba(0,0,0,0.35)] transition duration-200 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            aria-label="Apagar post"
          >
            <TrashIcon className="size-4" />
          </button>
        )}

        <Link
          href={`/posts/${post.postId}`}
          className="flex flex-1 flex-col gap-4 rounded-3xl p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(13,13,13,0.92)]"
        >
          <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
            <Date dateString={post.date} />
            <span className="opacity-80">{post.views ?? 0} leituras</span>
          </div>

          <h2 className="text-xl sm:text-[1.35rem] font-normal tracking-[0.2em] text-white transition-colors duration-300 group-hover:text-[var(--color-accent)]">
            {post.title}
          </h2>

          {post.tags?.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-muted)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </Link>
      </article>
    </li>
  );
}

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

  const currentSortKey = buildSortKey(sort, order);
  const currentSortLabel = (() => {
    const match = SORT_OPTIONS.find((opt) => buildSortKey(opt.value.sort, opt.value.order) === currentSortKey);
    return match?.label ?? "Data (mais recente)";
  })();

  const onSelectSort = (key: SortKey) => {
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
    const next = buildUrl(pathname, sp, { query: newQuery }, { resetPage: true });
    router.push(next);
  };

  const sectionRef = useReveal<HTMLDivElement>({ threshold: 0.2 });

  return (
    <section className={layoutClasses.section}>
      <div ref={sectionRef} className={`reveal-init ${layoutClasses.grid}`}>
        <div className={layoutClasses.columns.full}>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-[0.35em] text-[var(--color-muted)]">Explorar</span>
                <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] leading-tight">Últimos manifestos</h2>
              </div>
              <div className="flex flex-col gap-3 sm:w-auto">
                <SearchBar
                  onSearch={onSearch}
                  initialQuery={query}
                  className="w-full sm:w-[320px]"
                />
                <div className="relative" ref={sortRef}>
                  <button
                    type="button"
                    aria-label="Ordenar"
                    aria-haspopup="listbox"
                    aria-expanded={openSort}
                    onClick={() => setOpenSort((v) => !v)}
                    className="motion-scale inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(22,22,22,0.6)] px-4 py-2 text-xs uppercase tracking-[0.28em] text-[var(--color-muted)] transition hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    <span className="whitespace-nowrap">{currentSortLabel}</span>
                    <ChevronDownIcon className={`size-4 transition-transform duration-200 ${openSort ? "rotate-180" : "rotate-0"}`} />
                  </button>
                  {openSort && (
                    <div
                      role="listbox"
                      className="absolute right-0 z-20 mt-3 w-64 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[rgba(18,18,18,0.95)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
                    >
                      {SORT_OPTIONS.map((opt) => {
                        const key = buildSortKey(opt.value.sort, opt.value.order);
                        const selected = key === currentSortKey;
                        return (
                          <button
                            key={key}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => onSelectSort(key)}
                            className={`w-full rounded-xl px-4 py-3 text-left text-sm transition hover:bg-[rgba(255,255,255,0.05)] ${
                              selected ? "text-white" : "text-[var(--color-muted)]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-[rgba(255,75,139,0.45)] bg-[rgba(255,75,139,0.1)] px-4 py-3 text-sm text-[var(--color-text)]">
                {error}
              </div>
            )}

            {posts.length === 0 ? (
              <div className="rounded-3xl border border-[var(--color-border)] bg-[rgba(20,20,20,0.6)] p-8 text-sm text-[var(--color-muted)]">
                <p className="mb-2 font-medium text-[var(--color-text)]">Nenhum post encontrado.</p>
                <p>Ajuste a busca ou tente outros filtros.</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-2">
                {posts.map((post) => (
                  <PostCard key={post.postId} post={post} isAdmin={isAdmin} onDeleteRequest={openDeleteModal} />
                ))}
              </ul>
            )}

            <Pagination
              page={page}
              hasNext={hasNext}
              pathname={pathname}
              searchParams={Object.fromEntries(sp.entries())}
            />
          </div>
        </div>
      </div>

      {showDeleteModal && postToDelete && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[rgba(15,15,15,0.92)] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.55)]">
            <h2 className="text-lg font-normal tracking-[0.3em] text-white">Confirmar exclusão</h2>
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              Tem certeza que deseja apagar o post "
              <span className="text-[var(--color-text)]">
                {posts.find((p) => p.postId === postToDelete)?.title ?? "Este post"}
              </span>
              "?
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                className="motion-scale inline-flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] px-5 py-2 text-xs uppercase tracking-[0.2em] text-[var(--color-muted)] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletePost(postToDelete)}
                className="motion-scale inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-black transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(15,15,15,0.92)]"
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
