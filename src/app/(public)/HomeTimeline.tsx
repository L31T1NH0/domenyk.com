"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { EyeIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { NoteCard } from "@/components/notes/NoteCard"
import { NoteComposer } from "@/components/notes/NoteComposer"
import { AutoFitText } from "@/components/text/AutoFitText"
import type { SerializedNote } from "@/lib/db/notes"
import type { SerializedPostSummary } from "@/lib/db/posts"

type Props = {
  posts: SerializedPostSummary[]
  totalPosts: number
  totalNotes: number
  initialNotes: SerializedNote[]
  feedMode: FeedMode
  searchQuery: string
  currentPage: number
  pageSize: number
  totalPages: number
  isAdmin: boolean
}

type TimelineItem =
  | { type: "note"; id: string; date: string; note: SerializedNote }
  | { type: "post"; id: string; date: string; post: SerializedPostSummary }

type TimelineDisplayItem =
  TimelineItem

type FeedMode = "all" | "posts" | "notes"

function postDate(post: SerializedPostSummary) {
  return post.publishedAt ?? post.createdAt
}

function postDateLabel(post: SerializedPostSummary) {
  return format(new Date(postDate(post)), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

function postShowsTimelineCover(post: SerializedPostSummary) {
  return Boolean(post.cover?.url) && post.showCoverInTimeline !== false
}

function itemHasCoverPost(item: TimelineDisplayItem | undefined) {
  return item?.type === "post" && postShowsTimelineCover(item.post)
}

function itemNeedsTextSeparator(item: TimelineDisplayItem | undefined) {
  return item?.type === "note" || (item?.type === "post" && !postShowsTimelineCover(item.post))
}

function itemShouldHaveTopSeparator(item: TimelineDisplayItem | undefined, previousItem: TimelineDisplayItem | undefined) {
  return itemNeedsTextSeparator(item) && Boolean(previousItem) && (previousItem?.type === "note" || itemHasCoverPost(previousItem))
}

function PostTimelineItem({
  post,
  showTopSeparator,
  showBottomSeparator,
  isAdmin,
  onHide,
  hiding,
  pendingHide,
}: {
  post: SerializedPostSummary
  showTopSeparator: boolean
  showBottomSeparator: boolean
  isAdmin: boolean
  onHide: (post: SerializedPostSummary) => void
  hiding: boolean
  pendingHide: boolean
}) {
  const showCover = postShowsTimelineCover(post)

  return (
    <li
      className={[
        "group relative py-4 first:pt-0",
        showTopSeparator ? "border-t border-neutral-200 dark:border-white/10" : "",
        showBottomSeparator ? "border-b border-neutral-200 dark:border-white/10" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {post.pinned && (
        <span className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3" aria-hidden>
            <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
          </svg>
          Fixado
        </span>
      )}
      <Link href={`/posts/${post.slug}`} prefetch={false} className="block text-left focus-visible:outline-none">
        {showCover ? (
          <span className="relative block aspect-video w-full overflow-hidden rounded-xl bg-neutral-200 dark:bg-white/5">
            <Image
              src={post.cover!.url}
              alt={post.cover!.alt ?? post.title}
              width={1920}
              height={1080}
              sizes="(max-width: 640px) calc(100vw - 2.5rem), 32.5rem"
              className="h-full w-full rounded-xl object-cover !grayscale-0"
            />
            <span className="pointer-events-none absolute inset-0 rounded-xl">
              <span className="absolute left-0 top-0 h-2/5 w-full bg-gradient-to-b from-[#040404]/85 via-[#040404]/55 to-transparent" />
              <span className="absolute bottom-0 left-0 h-3/5 w-full bg-gradient-to-t from-[#040404]/90 via-[#040404]/58 to-transparent" />
            </span>
            <span className="absolute bottom-2 left-3 right-3 flex flex-col gap-2 sm:bottom-3">
              <AutoFitText
                text={post.title}
                minSize={15}
                maxSize={19}
                maxLines={2}
                className="font-normal leading-snug text-white"
              />
              <span className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-zinc-300 drop-shadow">{postDateLabel(post)}</span>
                <span aria-hidden className="text-zinc-300/50">·</span>
                <span className="text-xs text-zinc-300 tabular-nums drop-shadow">{post.views ?? 0} views</span>
                {!post.published && <span className="text-xs text-amber-300 drop-shadow">rascunho</span>}
              </span>
            </span>
          </span>
        ) : (
          <span className="flex min-w-0 flex-col gap-2">
            <AutoFitText
              text={post.title}
              minSize={14}
              maxSize={17}
              maxLines={2}
              className="font-normal leading-snug text-neutral-950 dark:text-[#f1f1f1]"
            />
            <span className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-[#A8A095]">{postDateLabel(post)}</span>
              <span aria-hidden className="text-[#A8A095]/40">·</span>
              <span className="text-xs text-[#A8A095] tabular-nums">{post.views ?? 0} views</span>
              {!post.published && <span className="text-xs text-amber-400">rascunho</span>}
            </span>
          </span>
        )}
      </Link>
      {isAdmin && (
        <button
          type="button"
          onClick={() => onHide(post)}
          disabled={hiding}
          aria-label={`Esconder ${post.title} da timeline`}
          title={`Esconder ${post.title} da timeline`}
          className={[
            "absolute right-0 z-10 inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium opacity-100 shadow-sm backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100",
            pendingHide
              ? "border-red-500/40 bg-red-500/15 text-red-200 hover:bg-red-500/25 focus-visible:ring-red-500/40"
              : "border-neutral-300 bg-white/80 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-[#A8A095]/40 dark:border-white/10 dark:bg-black/45 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]",
            showCover ? "top-7" : "top-4",
          ].join(" ")}
        >
          {hiding ? (
            "Ocultando..."
          ) : pendingHide ? (
            "Confirmar ocultar?"
          ) : (
            <>
              <EyeIcon className="size-4" aria-hidden />
              <span>Ocultar</span>
            </>
          )}
        </button>
      )}
    </li>
  )
}

function pageHref(page: number, mode: FeedMode, searchQuery: string) {
  const params = new URLSearchParams()
  if (mode !== "all") params.set("mode", mode)
  if (searchQuery) params.set("q", searchQuery)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/?${query}` : "/"
}

function modeHref(mode: FeedMode, searchQuery: string) {
  const params = new URLSearchParams()
  if (mode !== "all") params.set("mode", mode)
  if (searchQuery) params.set("q", searchQuery)
  const query = params.toString()
  return query ? `/?${query}` : "/"
}

function Pagination({
  currentPage,
  totalPages,
  mode,
  searchQuery,
}: {
  currentPage: number
  totalPages: number
  mode: FeedMode
  searchQuery: string
}) {
  if (totalPages <= 1) return null

  const visiblePageCount = Math.min(3, totalPages)
  const startPage = Math.min(currentPage, totalPages - visiblePageCount + 1)
  const pages = Array.from({ length: visiblePageCount }, (_, index) => startPage + index)

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Paginação">
      {currentPage > 1 && (
        <Link
          href={pageHref(currentPage - 1, mode, searchQuery)}
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-200"
        >
          Anterior
        </Link>
      )}
      {pages.map((page) => {
        const active = page === currentPage
        return (
          <Link
            key={page}
            href={pageHref(page, mode, searchQuery)}
            aria-current={active ? "page" : undefined}
            className={[
              "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors",
              active
                ? "bg-neutral-950 text-white dark:bg-[#A8A095] dark:text-black"
                : "text-neutral-500 hover:bg-neutral-950/5 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-200",
            ].join(" ")}
          >
            {page}
          </Link>
        )
      })}
      {currentPage < totalPages && (
        <Link
          href={pageHref(currentPage + 1, mode, searchQuery)}
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-200"
        >
          Próxima
        </Link>
      )}
    </nav>
  )
}

export function HomeTimeline({ posts, totalPosts, totalNotes, initialNotes, feedMode, searchQuery, currentPage, pageSize, totalPages, isAdmin }: Props) {
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [timelinePosts, setTimelinePosts] = useState(posts)
  const [postCount, setPostCount] = useState(totalPosts)
  const [noteCount, setNoteCount] = useState(totalNotes)
  const [notes, setNotes] = useState(initialNotes)
  const timelineCount = postCount + noteCount
  const hasSearch = searchQuery.length > 0
  const [hidingPostId, setHidingPostId] = useState<string | null>(null)
  const [pendingHidePostId, setPendingHidePostId] = useState<string | null>(null)
  const [hideError, setHideError] = useState("")
  const pendingHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageStartIndex = (currentPage - 1) * pageSize

  const resetPendingHide = useCallback(() => {
    if (pendingHideTimeoutRef.current) {
      clearTimeout(pendingHideTimeoutRef.current)
      pendingHideTimeoutRef.current = null
    }
    setPendingHidePostId(null)
  }, [])

  const schedulePendingHideTimeout = useCallback((postId: string) => {
    if (pendingHideTimeoutRef.current) clearTimeout(pendingHideTimeoutRef.current)
    pendingHideTimeoutRef.current = setTimeout(() => {
      setPendingHidePostId((current) => (current === postId ? null : current))
      pendingHideTimeoutRef.current = null
    }, 4000)
  }, [])

  useEffect(() => {
    return () => {
      if (pendingHideTimeoutRef.current) clearTimeout(pendingHideTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const allItems = useMemo<TimelineItem[]>(() => {
    return [
      ...notes.map((note) => ({ type: "note" as const, id: `note:${note._id}`, date: note.publishedAt, note })),
      ...timelinePosts.map((post) => ({ type: "post" as const, id: `post:${post.publicId}`, date: postDate(post), post })),
    ].sort((a, b) => {
      const aPinned = a.type === "post" && a.post.pinned
      const bPinned = b.type === "post" && b.post.pinned

      if (aPinned !== bPinned) return aPinned ? -1 : 1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [notes, timelinePosts])

  const visibleItems = useMemo<TimelineDisplayItem[]>(() => {
    if (feedMode === "posts") {
      return allItems.filter((item) => item.type === "post").slice(pageStartIndex, pageStartIndex + pageSize)
    }

    if (feedMode === "notes") {
      return allItems.filter((item) => item.type === "note").slice(pageStartIndex, pageStartIndex + pageSize)
    }

    return allItems.slice(pageStartIndex, pageStartIndex + pageSize)
  }, [allItems, feedMode, pageSize, pageStartIndex])

  function handlePosted(note: SerializedNote) {
    setNotes((prev) => [note, ...prev])
    setNoteCount((prev) => prev + 1)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/notes/${id}`, { method: "DELETE" })
    setNotes((prev) => prev.filter((note) => note._id !== id))
    setNoteCount((prev) => Math.max(0, prev - 1))
  }

  function handleUpdate(updatedNote: SerializedNote) {
    setNotes((prev) => prev.map((note) => note._id === updatedNote._id ? updatedNote : note))
  }

  async function handleHidePost(postToHide: SerializedPostSummary) {
    if (!isAdmin || hidingPostId) return
    if (pendingHidePostId !== postToHide._id) {
      setPendingHidePostId(postToHide._id)
      schedulePendingHideTimeout(postToHide._id)
      return
    }

    resetPendingHide()
    setHidingPostId(postToHide._id)
    setHideError("")

    try {
      const res = await fetch(`/api/admin/posts/${postToHide._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenFromTimeline: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Não foi possível esconder o post.")
      }

      setTimelinePosts((prev) => prev.filter((post) => post._id !== postToHide._id))
      setPostCount((prev) => Math.max(0, prev - 1))
      router.refresh()
    } catch (err) {
      setHideError(err instanceof Error ? err.message : "Não foi possível esconder o post.")
    } finally {
      setHidingPostId(null)
    }
  }

  const modeOptions = [
    { mode: "all" as const, label: "Tudo", count: timelineCount },
    { mode: "posts" as const, label: "Posts", count: postCount },
    { mode: "notes" as const, label: "Notas", count: noteCount },
  ]

  return (
    <section aria-label="Timeline" className="flex w-full min-w-0 flex-col gap-5 self-center">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <h1 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-950 dark:text-[#f1f1f1]">
              Timeline
              <span className="tabular-nums font-normal">({timelineCount})</span>
            </h1>

            <form action="/" className="min-w-0 sm:ml-2 sm:w-60">
              <div
                className={[
                  "flex h-8 min-w-0 items-center gap-2 rounded-full border px-2.5 text-neutral-950 transition-colors",
                  "border-neutral-300 bg-transparent focus-within:border-neutral-500 focus-within:bg-white/70",
                  "dark:border-white/10 dark:text-[#f1f1f1] dark:focus-within:border-[#A8A095]/50 dark:focus-within:bg-white/[0.04]",
                  hasSearch ? "border-neutral-400 dark:border-[#A8A095]/45" : "",
                ].join(" ")}
              >
                <MagnifyingGlassIcon className="size-3.5 shrink-0 text-neutral-500 dark:text-[#A8A095]" aria-hidden />
                <input
                  ref={searchInputRef}
                  type="text"
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="Pesquisar posts..."
                  aria-label="Pesquisar posts e notas"
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-500 dark:placeholder:text-[#A8A095]/65"
                />
                {feedMode !== "all" && <input type="hidden" name="mode" value={feedMode} />}
                {hasSearch && (
                  <>
                    <span className="h-4 w-px bg-neutral-300 dark:bg-white/10" aria-hidden />
                    <Link
                      href={modeHref(feedMode, "")}
                      aria-label="Limpar busca"
                      title="Limpar busca"
                      className="grid size-4 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]"
                    >
                      <XMarkIcon className="size-3" aria-hidden />
                    </Link>
                  </>
                )}
              </div>
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {modeOptions.map((option) => {
              const active = feedMode === option.mode
              return (
                <Link
                  key={option.mode}
                  href={modeHref(option.mode, searchQuery)}
                  className={[
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                    active
                      ? "border-neutral-400 bg-neutral-950/10 text-neutral-950 dark:border-[#A8A095]/60 dark:bg-[#A8A095]/15 dark:text-[#f1f1f1]"
                      : "border-neutral-300 text-neutral-600 hover:bg-neutral-950/5 hover:text-neutral-950 dark:border-white/10 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]",
                  ].join(" ")}
                >
                  {option.label}
                  <span className="tabular-nums opacity-70">{option.count}</span>
                </Link>
              )
            })}
          </div>

        </div>

        {isAdmin && <NoteComposer onPosted={handlePosted} />}
        {hideError && <p className="text-sm text-red-400">{hideError}</p>}

        {visibleItems.length === 0 ? (
          <div className="text-sm text-zinc-400">
            <p>{hasSearch ? "Nenhum resultado encontrado." : "Nenhum post ou nota publicado ainda."}</p>
          </div>
        ) : (
          <ul className="ml-0 min-w-0">
            {visibleItems.map((item, index) => (
              item.type === "note" ? (
                <li key={item.id} className="min-w-0">
                  <NoteCard
                    note={item.note}
                    isAdmin={isAdmin}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    cropTallImages
                  />
                </li>
              ) : (
                <PostTimelineItem
                  key={item.id}
                  post={item.post}
                  isAdmin={isAdmin}
                  onHide={handleHidePost}
                  hiding={hidingPostId === item.post._id}
                  pendingHide={pendingHidePostId === item.post._id}
                  showTopSeparator={itemShouldHaveTopSeparator(item, visibleItems[index - 1])}
                  showBottomSeparator={itemNeedsTextSeparator(item)}
                />
              )
            ))}
          </ul>
        )}

        <Pagination currentPage={currentPage} totalPages={totalPages} mode={feedMode} searchQuery={searchQuery} />
      </div>
    </section>
  )
}
