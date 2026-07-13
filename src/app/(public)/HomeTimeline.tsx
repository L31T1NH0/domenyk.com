"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type MouseEvent, type PointerEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ChatBubbleBottomCenterTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
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
  searchError?: string
  currentPage: number
  pageSize: number
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
  const isEditorial = post.style === "editorial"

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
        <span className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600 dark:text-[#A8A095]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3" aria-hidden>
            <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
          </svg>
          Fixado
        </span>
      )}
      <Link href={`/posts/${post.slug}`} prefetch={false} className="block rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 dark:focus-visible:ring-neutral-300 dark:focus-visible:ring-offset-[#040404]">
        {showCover && isEditorial ? (
          <span className="flex min-w-0 flex-col gap-3">
            <span className="relative block aspect-video w-full overflow-hidden rounded-xl bg-neutral-200 dark:bg-white/5">
              <Image
                src={post.cover!.url}
                alt={post.cover!.alt ?? post.title}
                width={1920}
                height={1080}
                sizes="(max-width: 640px) calc(100vw - 2.5rem), 32.5rem"
                className="h-full w-full rounded-xl object-cover !grayscale-0"
              />
            </span>
            <span className="flex min-w-0 flex-col gap-2">
              <AutoFitText
                as="h2"
                text={post.title.toLocaleUpperCase("pt-BR")}
                minSize={14}
                maxSize={17}
                maxLines={3}
                className="font-editorial-mono font-semibold uppercase leading-[1.2] tracking-[-0.025em] text-neutral-950 dark:text-[#f1f1f1]"
              />
              <span className="flex flex-wrap items-center gap-3 font-editorial-mono text-[11px] text-neutral-600 dark:text-[#A8A095]">
                <span>{post.views ?? 0} views</span>
                {!post.published && <span className="text-amber-400">rascunho</span>}
              </span>
            </span>
          </span>
        ) : showCover ? (
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
                as="h2"
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
              as="h2"
              text={isEditorial ? post.title.toLocaleUpperCase("pt-BR") : post.title}
              minSize={14}
              maxSize={17}
              maxLines={2}
              className={isEditorial
                ? "font-editorial-mono font-semibold uppercase leading-[1.2] tracking-[-0.025em] text-neutral-950 dark:text-[#f1f1f1]"
                : "font-normal leading-snug text-neutral-950 dark:text-[#f1f1f1]"}
            />
            <span className="flex flex-wrap items-center gap-3">
              {isEditorial ? (
                <span className="font-editorial-mono text-[11px] text-neutral-600 tabular-nums dark:text-[#A8A095]">{post.views ?? 0} views</span>
              ) : (
                <>
                  <span className="text-xs text-neutral-600 dark:text-[#A8A095]">{postDateLabel(post)}</span>
                  <span aria-hidden className="text-neutral-400 dark:text-[#A8A095]/60">·</span>
                  <span className="text-xs text-neutral-600 tabular-nums dark:text-[#A8A095]">{post.views ?? 0} views</span>
                </>
              )}
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

function normalizeSearchQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120)
}

const feedModeOrder: FeedMode[] = ["all", "posts", "notes"]
const SWIPE_THRESHOLD = 46
const SWIPE_MAX_OFFSET = 72

function useTimelineFeed({
  notes,
  posts,
  postCount,
  noteCount,
  mode,
  page,
  pageSize,
}: {
  notes: SerializedNote[]
  posts: SerializedPostSummary[]
  postCount: number
  noteCount: number
  mode: FeedMode
  page: number
  pageSize: number
}) {
  const timelineCount = postCount + noteCount
  const total = mode === "posts" ? postCount : mode === "notes" ? noteCount : timelineCount
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const activePage = Math.min(page, totalPages)

  const allItems = useMemo<TimelineItem[]>(() => {
    return [
      ...notes.map((note) => ({ type: "note" as const, id: `note:${note._id}`, date: note.publishedAt, note })),
      ...posts.map((post) => ({ type: "post" as const, id: `post:${post.publicId}`, date: postDate(post), post })),
    ].sort((a, b) => {
      const aPinned = a.type === "post" && a.post.pinned
      const bPinned = b.type === "post" && b.post.pinned

      if (aPinned !== bPinned) return aPinned ? -1 : 1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [notes, posts])

  const visibleItems = useMemo<TimelineDisplayItem[]>(() => {
    if (mode === "posts") {
      return allItems.filter((item) => item.type === "post")
    }

    if (mode === "notes") {
      return allItems.filter((item) => item.type === "note")
    }

    return allItems
  }, [allItems, mode])

  return { timelineCount, totalPages, activePage, visibleItems }
}

function isInteractiveTarget(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, button, [data-swipe-ignore]"))
}

function getAdjacentMode(deltaX: number, mode: FeedMode) {
  const currentIndex = feedModeOrder.indexOf(mode)
  const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1
  return feedModeOrder[nextIndex]
}

function useTimelineSwipeNavigation(mode: FeedMode, switchMode: (mode: FeedMode) => void) {
  const pointerStartRef = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null)
  const suppressNextClickRef = useRef(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwipeSettling, setIsSwipeSettling] = useState(false)

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") return
    if (window.matchMedia("(min-width: 640px)").matches) return
    if (isInteractiveTarget(event.target)) return

    pointerStartRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some synthetic/browser-dispatched pointer events are not capturable.
    }
    setIsSwipeSettling(false)
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const start = pointerStartRef.current
    if (!start || start.id !== event.pointerId) return
    if (window.matchMedia("(min-width: 640px)").matches) return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (!start.active) {
      if (absY > 18 && absY > absX * 1.15) {
        pointerStartRef.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        return
      }
      if (absX < 10 || absX < absY * 0.9) return
      start.active = true
    }

    const hasAdjacentMode = Boolean(getAdjacentMode(deltaX, mode))
    const resistance = hasAdjacentMode ? 0.82 : 0.2
    const offset = Math.max(-SWIPE_MAX_OFFSET, Math.min(SWIPE_MAX_OFFSET, deltaX * resistance))
    setSwipeOffset(offset)
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const start = pointerStartRef.current
    if (start && start.id !== event.pointerId) return
    pointerStartRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!start || window.matchMedia("(min-width: 640px)").matches) {
      setSwipeOffset(0)
      return
    }

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    setIsSwipeSettling(true)
    if (!start.active || Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 0.9) {
      setSwipeOffset(0)
      return
    }

    const nextMode = getAdjacentMode(deltaX, mode)
    if (!nextMode) {
      setSwipeOffset(0)
      return
    }

    switchMode(nextMode)
    suppressNextClickRef.current = true
    window.setTimeout(() => {
      suppressNextClickRef.current = false
    }, 350)
    setSwipeOffset(0)
  }

  function handlePointerCancel(event: PointerEvent<HTMLElement>) {
    const start = pointerStartRef.current
    if (start && start.id !== event.pointerId) return
    pointerStartRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsSwipeSettling(true)
    setSwipeOffset(0)
  }

  function handleClickCapture(event: MouseEvent<HTMLElement>) {
    if (!suppressNextClickRef.current) return
    suppressNextClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return {
    swipeOffset,
    isSwipeSettling,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleClickCapture,
  }
}

function Pagination({
  currentPage,
  totalPages,
  mode,
  searchQuery,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  mode: FeedMode
  searchQuery: string
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  const visiblePageCount = Math.min(3, totalPages)
  const startPage = Math.max(
    1,
    Math.min(currentPage - 1, totalPages - visiblePageCount + 1)
  )
  const pages = Array.from({ length: visiblePageCount }, (_, index) => startPage + index)

  return (
    <nav
      className="mt-8 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-t border-neutral-200 pt-4 dark:border-white/10"
      aria-label="Paginação"
    >
      {currentPage > 1 && (
        <a
          href={pageHref(currentPage - 1, mode, searchQuery)}
          data-swipe-ignore
          onClick={(event) => {
            event.preventDefault()
            onPageChange(currentPage - 1)
          }}
          rel="prev"
          className="group col-start-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md pr-2 text-sm text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-neutral-400 dark:hover:text-neutral-100 dark:focus-visible:ring-neutral-300"
        >
          <ChevronLeftIcon className="size-4 transition-transform duration-150 group-hover:-translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          <span>Anterior</span>
        </a>
      )}

      <ol className="col-start-2 row-start-1 flex items-center justify-center gap-0.5" aria-label="Páginas">
        {pages.map((page) => {
          const active = page === currentPage
          return (
            <li key={page}>
              <a
                href={pageHref(page, mode, searchQuery)}
                data-swipe-ignore
                onClick={(event) => {
                  event.preventDefault()
                  onPageChange(page)
                }}
                aria-current={active ? "page" : undefined}
                aria-label={active ? `Página ${page}, atual` : `Ir para a página ${page}`}
                className={[
                  "relative inline-flex size-10 items-center justify-center rounded-md text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:focus-visible:ring-neutral-300",
                  active
                    ? "font-semibold text-neutral-950 after:absolute after:inset-x-2.5 after:bottom-1 after:h-0.5 after:rounded-full after:bg-[#E00070] dark:text-neutral-100"
                    : "text-neutral-500 hover:bg-neutral-950/5 hover:text-neutral-950 dark:text-neutral-500 dark:hover:bg-white/[0.06] dark:hover:text-neutral-100",
                ].join(" ")}
              >
                {page}
              </a>
            </li>
          )
        })}
      </ol>

      {currentPage < totalPages && (
        <a
          href={pageHref(currentPage + 1, mode, searchQuery)}
          data-swipe-ignore
          onClick={(event) => {
            event.preventDefault()
            onPageChange(currentPage + 1)
          }}
          rel="next"
          className="group col-start-3 inline-flex min-h-11 w-fit items-center gap-1.5 justify-self-end rounded-md pl-2 text-sm text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-neutral-400 dark:hover:text-neutral-100 dark:focus-visible:ring-neutral-300"
        >
          <span>Próxima</span>
          <ChevronRightIcon className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </a>
      )}
    </nav>
  )
}

type ModeOption = {
  mode: FeedMode
  label: string
  count: number
}

const modeIcons = {
  all: Squares2X2Icon,
  posts: DocumentTextIcon,
  notes: ChatBubbleBottomCenterTextIcon,
} satisfies Record<FeedMode, typeof Squares2X2Icon>

function TimelineModeDock({
  options,
  activeMode,
  searchQuery,
  onModeChange,
}: {
  options: ModeOption[]
  activeMode: FeedMode
  searchQuery: string
  onModeChange: (mode: FeedMode) => void
}) {
  return (
    <nav
      data-timeline-mode-dock
      className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 flex-row items-center gap-0.5 rounded-full border border-neutral-200 bg-white p-0.5 shadow-[0_3px_8px_rgb(0_0_0_/_0.12)] dark:border-white/10 dark:bg-[#0b0b0b] dark:shadow-[0_3px_8px_rgb(0_0_0_/_0.35)] md:bottom-auto md:left-[calc(50%-18rem)] md:top-1/2 md:-ml-4 md:-translate-x-full md:-translate-y-1/2 md:flex-col"
      aria-label="Filtros da timeline"
    >
      {options.map((option) => {
        const active = activeMode === option.mode
        const Icon = modeIcons[option.mode]

        return (
          <a
            key={option.mode}
            href={modeHref(option.mode, searchQuery)}
            data-swipe-ignore
            onClick={(event) => {
              event.preventDefault()
              onModeChange(option.mode)
            }}
            aria-current={active ? "page" : undefined}
            aria-label={`${option.label}, ${option.count}`}
            className={[
              "group relative grid size-10 place-items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 motion-reduce:transition-none dark:focus-visible:ring-neutral-300 md:size-8",
              active
                ? "bg-neutral-950/[0.07] text-neutral-950 dark:bg-white/[0.10] dark:text-white"
                : "text-neutral-500 hover:bg-neutral-950/[0.05] hover:text-neutral-950 dark:text-neutral-500 dark:hover:bg-white/[0.07] dark:hover:text-neutral-100",
            ].join(" ")}
          >
            <Icon className="size-[17px] md:size-4" strokeWidth={active ? 1.9 : 1.6} aria-hidden />
            {active && (
              <span
                aria-hidden
                className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-[#E00070] ring-2 ring-white dark:ring-[#0b0b0b] md:right-0 md:top-0"
              />
            )}
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full top-1/2 ml-2 hidden -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md border border-white/10 bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-[0_3px_8px_rgb(0_0_0_/_0.22)] transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none md:block"
            >
              {option.label}
              <span className="ml-1.5 tabular-nums text-neutral-400">{option.count}</span>
            </span>
          </a>
        )
      })}
    </nav>
  )
}

export function HomeTimeline({ posts, totalPosts, totalNotes, initialNotes, feedMode, searchQuery, searchError = "", currentPage, pageSize, isAdmin }: Props) {
  const router = useRouter()
  const sectionRef = useRef<HTMLElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRequestedSearchRef = useRef(searchQuery)
  const [timelinePosts, setTimelinePosts] = useState(posts)
  const [postCount, setPostCount] = useState(totalPosts)
  const [noteCount, setNoteCount] = useState(totalNotes)
  const [notes, setNotes] = useState(initialNotes)
  const optimisticFeedMode = feedMode
  const optimisticPage = currentPage
  const hasSearch = searchQuery.length > 0
  const [searchInput, setSearchInput] = useState(searchQuery)
  const hasSearchInput = searchInput.length > 0
  const [hidingPostId, setHidingPostId] = useState<string | null>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [pendingHidePostId, setPendingHidePostId] = useState<string | null>(null)
  const [hideError, setHideError] = useState("")
  const [noteError, setNoteError] = useState("")
  const [isPagePending, startPageTransition] = useTransition()
  const pendingHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { timelineCount, totalPages: optimisticTotalPages, activePage, visibleItems } = useTimelineFeed({
    notes,
    posts: timelinePosts,
    postCount,
    noteCount,
    mode: optimisticFeedMode,
    page: optimisticPage,
    pageSize,
  })

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
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [])

  const applySearch = useCallback((value: string) => {
    const normalizedQuery = normalizeSearchQuery(value)
    if (normalizedQuery === searchQuery) return
    lastRequestedSearchRef.current = normalizedQuery

    startPageTransition(() => {
      router.replace(modeHref(optimisticFeedMode, normalizedQuery), { scroll: false })
    })
  }, [optimisticFeedMode, router, searchQuery])

  useEffect(() => {
    const normalizedQuery = normalizeSearchQuery(searchInput)
    if (normalizedQuery === searchQuery || normalizedQuery === lastRequestedSearchRef.current) return

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null
      applySearch(searchInput)
    }, 550)

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
    }
  }, [applySearch, searchInput, searchQuery])

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

  function handlePosted(note: SerializedNote) {
    setNotes((prev) => [note, ...prev])
    setNoteCount((prev) => prev + 1)
  }

  async function handleDelete(id: string) {
    if (deletingNoteId) return
    setDeletingNoteId(id)
    setNoteError("")

    try {
      const response = await fetch(`/api/admin/notes/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? "Não foi possível deletar a nota.")
      }

      setNotes((prev) => prev.filter((note) => note._id !== id))
      setNoteCount((prev) => Math.max(0, prev - 1))
      router.refresh()
    } catch (caughtError) {
      setNoteError(caughtError instanceof Error ? caughtError.message : "Não foi possível deletar a nota.")
    } finally {
      setDeletingNoteId(null)
    }
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

  function scrollToTimelineStart() {
    sectionRef.current?.scrollIntoView({ block: "start" })
  }

  function switchMode(nextMode: FeedMode) {
    const currentInputQuery = normalizeSearchQuery(searchInput)
    if (nextMode === optimisticFeedMode && optimisticPage === 1 && currentInputQuery === searchQuery) {
      scrollToTimelineStart()
      return
    }

    startPageTransition(() => {
      router.push(modeHref(nextMode, currentInputQuery), { scroll: false })
    })
    scrollToTimelineStart()
  }

  function switchPage(nextPage: number) {
    const clampedPage = Math.min(Math.max(1, nextPage), optimisticTotalPages)
    startPageTransition(() => {
      router.push(pageHref(clampedPage, optimisticFeedMode, searchQuery), { scroll: false })
    })
    scrollToTimelineStart()
  }

  const swipeNavigation = useTimelineSwipeNavigation(optimisticFeedMode, switchMode)

  const modeOptions = [
    { mode: "all" as const, label: "Tudo", count: timelineCount },
    { mode: "posts" as const, label: "Posts", count: postCount },
    { mode: "notes" as const, label: "Notas", count: noteCount },
  ]

  return (
    <section
      ref={sectionRef}
      aria-label="Timeline"
      aria-busy={isPagePending}
      className="flex w-full min-w-0 touch-pan-y flex-col gap-5 self-center"
      onPointerDownCapture={swipeNavigation.handlePointerDown}
      onPointerMoveCapture={swipeNavigation.handlePointerMove}
      onPointerUpCapture={swipeNavigation.handlePointerUp}
      onPointerCancelCapture={swipeNavigation.handlePointerCancel}
      onClickCapture={swipeNavigation.handleClickCapture}
    >
      <TimelineModeDock
        options={modeOptions}
        activeMode={optimisticFeedMode}
        searchQuery={normalizeSearchQuery(searchInput)}
        onModeChange={switchMode}
      />

      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 flex-col items-start gap-3">
            <form
              action="/"
              className="w-[min(100%,14rem)] min-w-0 sm:w-56"
              onSubmit={(event) => {
                event.preventDefault()
                if (searchDebounceRef.current) {
                  clearTimeout(searchDebounceRef.current)
                  searchDebounceRef.current = null
                }
                applySearch(searchInput)
              }}
            >
              <div
                className={[
                  "flex h-8 min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-neutral-950 transition-colors",
                  "border-neutral-300 bg-transparent focus-within:border-neutral-500 focus-within:bg-white/70 focus-within:ring-1 focus-within:ring-neutral-500/50",
                  "dark:border-white/10 dark:text-[#f1f1f1] dark:focus-within:border-[#A8A095]/50 dark:focus-within:bg-white/[0.04] dark:focus-within:ring-neutral-300/60",
                  hasSearchInput ? "border-neutral-400 dark:border-[#A8A095]/45" : "",
                ].join(" ")}
              >
                <MagnifyingGlassIcon className="size-3.5 shrink-0 text-neutral-500 dark:text-[#A8A095]" aria-hidden />
                <input
                  ref={searchInputRef}
                  type="text"
                  name="q"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Pesquisar posts..."
                  aria-label="Pesquisar posts e notas"
                  autoComplete="off"
                  maxLength={120}
                  className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-600 dark:placeholder:text-[#c2bbb1]"
                />
                {optimisticFeedMode !== "all" && <input type="hidden" name="mode" value={optimisticFeedMode} />}
                {hasSearchInput && (
                  <>
                    <span className="h-3.5 w-px bg-neutral-300 dark:bg-white/10" aria-hidden />
                    <Link
                      href={modeHref(optimisticFeedMode, "")}
                      data-swipe-ignore
                      onClick={(event) => {
                        event.preventDefault()
                        if (searchDebounceRef.current) {
                          clearTimeout(searchDebounceRef.current)
                          searchDebounceRef.current = null
                        }
                        setSearchInput("")
                        applySearch("")
                        searchInputRef.current?.focus()
                      }}
                      aria-label="Limpar busca"
                      title="Limpar busca"
                      className="grid size-6 shrink-0 place-items-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#c2bbb1] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
                    >
                      <XMarkIcon className="size-3" aria-hidden />
                    </Link>
                  </>
                )}
              </div>
            </form>
          </div>

        </div>

        {isAdmin && <NoteComposer onPosted={handlePosted} />}
        {hideError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{hideError}</p>}
        {noteError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{noteError}</p>}
        {searchError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{searchError}</p>}
        {isPagePending && <p role="status" className="sr-only">Carregando página da timeline...</p>}

        <div
          className="min-w-0 will-change-transform motion-reduce:!translate-x-0 motion-reduce:!opacity-100 motion-reduce:!transition-none"
          style={{
            opacity: 1 - Math.min(Math.abs(swipeNavigation.swipeOffset) / 420, 0.18),
            transform: `translate3d(${swipeNavigation.swipeOffset}px, 0, 0)`,
            transition: swipeNavigation.isSwipeSettling ? "transform 120ms cubic-bezier(0.16, 1, 0.3, 1), opacity 100ms ease-out" : "none",
          }}
        >
          {visibleItems.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              <p>{hasSearch ? "Nenhum resultado encontrado." : "Nenhum post ou nota publicado ainda."}</p>
            </div>
          ) : (
            <ul className="ml-0 min-w-0">
              {visibleItems.map((item, index) => (
                item.type === "note" ? (
                  <li key={item.id} className="min-w-0">
                    <NoteCard
                      note={item.note}
                      viewContext="home"
                      isAdmin={isAdmin}
                      onDelete={handleDelete}
                      onUpdate={handleUpdate}
                      deleting={deletingNoteId === item.note._id}
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

          <Pagination
            currentPage={activePage}
            totalPages={optimisticTotalPages}
            mode={optimisticFeedMode}
            searchQuery={searchQuery}
            onPageChange={switchPage}
          />
        </div>
      </div>
    </section>
  )
}
