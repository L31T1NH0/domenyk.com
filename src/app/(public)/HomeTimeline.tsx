"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type MouseEvent, type PointerEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUturnLeftIcon,
  ChatBubbleBottomCenterTextIcon,
  DocumentTextIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { NoteCard } from "@/components/notes/NoteCard"
import { NoteComposer } from "@/components/notes/NoteComposer"
import { NoteTimelineGroup } from "@/components/notes/NoteTimelineGroup"
import { ContentActionMenu } from "@/components/actions/ContentActionMenu"
import { AutoFitText } from "@/components/text/AutoFitText"
import type { SerializedNote } from "@/lib/db/notes"
import type { SerializedPostSummary } from "@/lib/db/posts"
import { groupNotesByThread, mergeNotesById } from "@/lib/note-thread"
import { formatSiteDate } from "@/lib/datetime"

type Props = {
  posts: SerializedPostSummary[]
  totalPosts: number
  totalNotes: number
  initialNotes: SerializedNote[]
  desktopPosts: SerializedPostSummary[]
  desktopNotes: SerializedNote[]
  desktopThreadNotes: SerializedNote[]
  desktopPostCount: number
  desktopLooseNoteCount: number
  desktopThreadCount: number
  feedMode: FeedMode
  searchQuery: string
  searchError?: string
  pageSize: number
  isAdmin: boolean
}

type TimelineItem =
  | { type: "note"; id: string; date: string; note: SerializedNote }
  | { type: "post"; id: string; date: string; post: SerializedPostSummary }

type TimelineDisplayItem =
  | Extract<TimelineItem, { type: "post" }>
  | { type: "note-group"; id: string; date: string; notes: SerializedNote[] }

type FeedMode = "all" | "posts" | "notes"

type InfiniteTimelineResponse = {
  posts?: SerializedPostSummary[]
  notes?: SerializedNote[]
  desktopPosts?: SerializedPostSummary[]
  desktopNotes?: SerializedNote[]
  desktopThreadNotes?: SerializedNote[]
  error?: string
}

type ThreadRailManualSession = {
  origin: number
  threshold: number
  qualified: boolean
}

type ThreadRailPosition = {
  threadId: string | null
  offsetWithinThread: number
  fallbackScrollTop: number
}

type ThreadRailPill = "return" | null

function postDate(post: SerializedPostSummary) {
  return post.publishedAt ?? post.createdAt
}

function postDateLabel(post: SerializedPostSummary) {
  return formatSiteDate(postDate(post), { day: "numeric", month: "long", year: "numeric" })
}

function postShowsTimelineCover(post: SerializedPostSummary) {
  return Boolean(post.cover?.url) && post.showCoverInTimeline !== false
}

function PostTimelineItem({
  post,
  isAdmin,
  onHide,
  onDelete,
  hiding,
  deleting,
}: {
  post: SerializedPostSummary
  isAdmin: boolean
  onHide: (post: SerializedPostSummary) => Promise<void>
  onDelete: (post: SerializedPostSummary) => Promise<void>
  hiding: boolean
  deleting: boolean
}) {
  const showCover = postShowsTimelineCover(post)
  const isEditorial = post.style === "editorial"

  return (
    <li className="group relative py-4 first:pt-0">
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
        <div className={`absolute right-0 z-20 ${showCover ? "top-7" : "top-4"}`}>
          <ContentActionMenu
            label={`Ações do post: ${post.title}`}
            actions={[
              {
                label: "Editar post",
                icon: PencilSquareIcon,
                href: `/admin/posts/${post._id}/edit`,
                disabled: deleting,
              },
              {
                label: "Ocultar da timeline",
                icon: EyeSlashIcon,
                onSelect: () => onHide(post),
                disabled: hiding || deleting,
                pendingLabel: "Ocultando…",
              },
            ]}
            deleteAction={{
              title: `Excluir “${post.title}”?`,
              description: "O post e seus comentários serão apagados permanentemente.",
              onDelete: () => onDelete(post),
              disabled: hiding || deleting,
            }}
            triggerClassName={showCover
              ? "relative grid size-8 place-items-center rounded-md bg-black/55 text-white outline-none transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white/80"
              : "relative grid size-8 place-items-center rounded-md text-neutral-500 outline-none transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"}
          />
        </div>
      )}
    </li>
  )
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
}: {
  notes: SerializedNote[]
  posts: SerializedPostSummary[]
  postCount: number
  noteCount: number
  mode: FeedMode
}) {
  const timelineCount = postCount + noteCount

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
    const filteredItems = mode === "posts"
      ? allItems.filter((item) => item.type === "post")
      : mode === "notes"
        ? allItems.filter((item) => item.type === "note")
        : allItems
    const noteGroups = groupNotesByThread(
      filteredItems
        .filter((item): item is Extract<TimelineItem, { type: "note" }> => item.type === "note")
        .map((item) => item.note)
    )
    const groupByNoteId = new Map<string, SerializedNote[]>()
    for (const group of noteGroups) {
      for (const note of group) groupByNoteId.set(note._id, group)
    }
    const emittedGroups = new Set<string>()

    return filteredItems.flatMap((item): TimelineDisplayItem[] => {
      if (item.type === "post") return [item]
      const group = groupByNoteId.get(item.note._id) ?? [item.note]
      const groupId = group[0].thread?.rootId ?? group[0]._id
      if (emittedGroups.has(groupId)) return []
      emittedGroups.add(groupId)
      return [{ type: "note-group", id: `note-group:${groupId}`, date: item.date, notes: group }]
    })
  }, [allItems, mode])

  return { timelineCount, visibleItems }
}

function mergePostsById(current: SerializedPostSummary[], incoming: SerializedPostSummary[]) {
  const postsById = new Map(current.map((post) => [post._id, post]))
  for (const post of incoming) postsById.set(post._id, post)
  return Array.from(postsById.values())
}

function isInteractiveTarget(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, button, [data-swipe-ignore]"))
}

function threadSpanAtScrollPosition(rail: HTMLDivElement, scrollTop = rail.scrollTop) {
  const threads = Array.from(rail.querySelectorAll<HTMLElement>("[data-thread-index]"))
  if (threads.length === 0) return Math.max(1, rail.clientHeight)

  const firstOffset = threads[0].offsetTop
  let activeIndex = 0
  for (let index = 1; index < threads.length; index += 1) {
    if (scrollTop < threads[index].offsetTop - firstOffset) break
    activeIndex = index
  }

  const current = threads[activeIndex]
  const next = threads[activeIndex + 1]
  return Math.max(1, next ? next.offsetTop - current.offsetTop : current.offsetHeight)
}

function captureThreadRailPosition(rail: HTMLDivElement): ThreadRailPosition {
  const threads = Array.from(rail.querySelectorAll<HTMLElement>("[data-thread-index]"))
  if (threads.length === 0) {
    return { threadId: null, offsetWithinThread: 0, fallbackScrollTop: rail.scrollTop }
  }

  const firstOffset = threads[0].offsetTop
  let active = threads[0]
  for (let index = 1; index < threads.length; index += 1) {
    if (rail.scrollTop < threads[index].offsetTop - firstOffset) break
    active = threads[index]
  }

  const activeStart = active.offsetTop - firstOffset
  return {
    threadId: active.dataset.threadId ?? null,
    offsetWithinThread: Math.max(0, rail.scrollTop - activeStart),
    fallbackScrollTop: rail.scrollTop,
  }
}

function resolveThreadRailPosition(rail: HTMLDivElement, position: ThreadRailPosition) {
  const threads = Array.from(rail.querySelectorAll<HTMLElement>("[data-thread-index]"))
  const firstOffset = threads[0]?.offsetTop ?? 0
  const anchorIndex = position.threadId
    ? threads.findIndex((thread) => thread.dataset.threadId === position.threadId)
    : -1
  const anchor = anchorIndex >= 0 ? threads[anchorIndex] : null
  const nextAnchor = anchorIndex >= 0 ? threads[anchorIndex + 1] : null
  const anchorSpan = anchor
    ? Math.max(1, nextAnchor ? nextAnchor.offsetTop - anchor.offsetTop : anchor.offsetHeight)
    : 0
  const requestedTop = anchor
    ? anchor.offsetTop - firstOffset + Math.min(position.offsetWithinThread, anchorSpan - 1)
    : position.fallbackScrollTop
  const maxScrollTop = Math.max(0, rail.scrollHeight - rail.clientHeight)
  return Math.min(maxScrollTop, Math.max(0, requestedTop))
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
      className="home-timeline-mode-dock fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 flex-row items-center gap-0.5 rounded-full border border-neutral-200 bg-white p-0.5 shadow-[0_3px_8px_rgb(0_0_0_/_0.12)] dark:border-white/10 dark:bg-[#0b0b0b] dark:shadow-[0_3px_8px_rgb(0_0_0_/_0.35)] md:bottom-auto md:left-[calc(50%-18rem)] md:top-1/2 md:-ml-4 md:-translate-x-full md:-translate-y-1/2 md:flex-col min-[84rem]:left-[calc(32.5vw-11.9625rem)]"
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

export function HomeTimeline({ posts, totalPosts, totalNotes, initialNotes, desktopPosts, desktopNotes, desktopThreadNotes, desktopPostCount, desktopLooseNoteCount, desktopThreadCount, feedMode, searchQuery, searchError = "", pageSize, isAdmin }: Props) {
  const router = useRouter()
  const sectionRef = useRef<HTMLElement>(null)
  const primaryFeedRef = useRef<HTMLDivElement>(null)
  const threadRailScrollRef = useRef<HTMLDivElement>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null)
  const loadAbortRef = useRef<AbortController | null>(null)
  const loadingMoreRef = useRef(false)
  const nextPageRef = useRef(2)
  const lastSyncedThreadIndexRef = useRef(0)
  const wasDualTimelineViewportRef = useRef(false)
  const threadRailNeedsImmediateResyncRef = useRef(false)
  const threadRailAutoTargetRef = useRef<number | null>(null)
  const threadRailLastScrollTopRef = useRef(0)
  const threadRailManualInputRef = useRef(false)
  const threadRailManualInputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const threadRailManualSessionRef = useRef<ThreadRailManualSession | null>(null)
  const manualThreadRailPositionRef = useRef<ThreadRailPosition | null>(null)
  const undoThreadRailPositionRef = useRef<ThreadRailPosition | null>(null)
  const threadRailPillRef = useRef<ThreadRailPill>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRequestedSearchRef = useRef(searchQuery)
  const [timelinePosts, setTimelinePosts] = useState(posts)
  const [postCount, setPostCount] = useState(totalPosts)
  const [noteCount, setNoteCount] = useState(totalNotes)
  const [notes, setNotes] = useState(initialNotes)
  const [desktopTimelinePosts, setDesktopTimelinePosts] = useState(desktopPosts)
  const [desktopTimelineNotes, setDesktopTimelineNotes] = useState(desktopNotes)
  const [desktopRailNotes, setDesktopRailNotes] = useState(desktopThreadNotes)
  const [desktopTimelinePostCount, setDesktopTimelinePostCount] = useState(desktopPostCount)
  const [desktopTimelineNoteCount, setDesktopTimelineNoteCount] = useState(desktopLooseNoteCount)
  const [desktopRailThreadCount, setDesktopRailThreadCount] = useState(desktopThreadCount)
  const [threadRailOverflow, setThreadRailOverflow] = useState(false)
  const [threadRailAtEnd, setThreadRailAtEnd] = useState(true)
  const [threadRailPill, setThreadRailPill] = useState<ThreadRailPill>(null)
  const [loadedPage, setLoadedPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState("")
  const [isDualTimelineViewport, setIsDualTimelineViewport] = useState(false)
  const optimisticFeedMode = feedMode
  const hasSearch = searchQuery.length > 0
  const [searchInput, setSearchInput] = useState(searchQuery)
  const hasSearchInput = searchInput.length > 0
  const [hidingPostId, setHidingPostId] = useState<string | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [hideError, setHideError] = useState("")
  const [noteError, setNoteError] = useState("")
  const [threadParent, setThreadParent] = useState<SerializedNote | null>(null)
  const [linkingNoteId, setLinkingNoteId] = useState<string | null>(null)
  const [isNavigationPending, startNavigationTransition] = useTransition()
  const { timelineCount, visibleItems } = useTimelineFeed({
    notes,
    posts: timelinePosts,
    postCount,
    noteCount,
    mode: optimisticFeedMode,
  })
  const { visibleItems: desktopVisibleItems } = useTimelineFeed({
    notes: desktopTimelineNotes,
    posts: desktopTimelinePosts,
    postCount: desktopTimelinePostCount,
    noteCount: desktopTimelineNoteCount,
    mode: optimisticFeedMode,
  })
  const desktopThreadItems = useMemo<TimelineDisplayItem[]>(() => (
    groupNotesByThread(desktopRailNotes).flatMap((thread) => {
      if (thread.length < 2) return []
      const rootId = thread[0].thread?.rootId ?? thread[0]._id
      const latestDate = thread.reduce(
        (latest, note) => new Date(note.publishedAt).getTime() > new Date(latest).getTime() ? note.publishedAt : latest,
        thread[0].publishedAt
      )
      return [{ type: "note-group", id: `note-group:${rootId}`, date: latestDate, notes: thread }]
    })
  ), [desktopRailNotes])
  const mobileTotal = optimisticFeedMode === "posts"
    ? postCount
    : optimisticFeedMode === "notes"
      ? noteCount
      : postCount + noteCount
  const desktopPrimaryTotal = desktopTimelinePostCount + desktopTimelineNoteCount
  const primaryTotal = isDualTimelineViewport ? desktopPrimaryTotal : mobileTotal
  const primaryPageCount = Math.max(1, Math.ceil(primaryTotal / pageSize))
  const threadPageCount = Math.max(1, Math.ceil(desktopRailThreadCount / pageSize))
  const hasMorePrimaryItems = !searchError && loadedPage < primaryPageCount
  const hasMoreThreadItems = !searchError && isDualTimelineViewport && loadedPage < threadPageCount
  const hasMoreTimelineItems = hasMorePrimaryItems || hasMoreThreadItems

  useEffect(() => {
    function updateViewportMode() {
      const rail = threadRailScrollRef.current
      const isDual = Boolean(rail && rail.getClientRects().length > 0)
      const wasDual = wasDualTimelineViewportRef.current
      wasDualTimelineViewportRef.current = isDual
      setIsDualTimelineViewport(isDual)
      if (!isDual) {
        threadRailNeedsImmediateResyncRef.current = true
        threadRailAutoTargetRef.current = null
        threadRailLastScrollTopRef.current = 0
        manualThreadRailPositionRef.current = null
        undoThreadRailPositionRef.current = null
        threadRailManualSessionRef.current = null
        threadRailPillRef.current = null
        setThreadRailPill(null)
      } else if (!wasDual) {
        threadRailNeedsImmediateResyncRef.current = true
        threadRailAutoTargetRef.current = null
        lastSyncedThreadIndexRef.current = -1
      }
    }

    updateViewportMode()
    window.addEventListener("resize", updateViewportMode)
    window.addEventListener("orientationchange", updateViewportMode)
    return () => {
      window.removeEventListener("resize", updateViewportMode)
      window.removeEventListener("orientationchange", updateViewportMode)
    }
  }, [desktopThreadItems.length])

  const loadNextPage = useCallback(async () => {
    if (loadingMoreRef.current) return
    const page = nextPageRef.current
    loadingMoreRef.current = true
    setIsLoadingMore(true)
    setLoadMoreError("")

    const controller = new AbortController()
    loadAbortRef.current?.abort()
    loadAbortRef.current = controller

    try {
      const params = new URLSearchParams({ page: String(page), mode: optimisticFeedMode })
      if (searchQuery) params.set("q", searchQuery)
      const response = await fetch(`/api/timeline?${params.toString()}`, { signal: controller.signal })
      const data = await response.json().catch(() => null) as InfiniteTimelineResponse | null
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "Não foi possível carregar mais itens.")
      }
      if (
        !Array.isArray(data.posts) ||
        !Array.isArray(data.notes) ||
        !Array.isArray(data.desktopPosts) ||
        !Array.isArray(data.desktopNotes) ||
        !Array.isArray(data.desktopThreadNotes)
      ) {
        throw new Error("A resposta da timeline é inválida.")
      }

      setTimelinePosts((current) => mergePostsById(current, data.posts!))
      setNotes((current) => mergeNotesById(current, data.notes!))
      setDesktopTimelinePosts((current) => mergePostsById(current, data.desktopPosts!))
      setDesktopTimelineNotes((current) => mergeNotesById(current, data.desktopNotes!))
      setDesktopRailNotes((current) => mergeNotesById(current, data.desktopThreadNotes!))
      nextPageRef.current = page + 1
      setLoadedPage(page)
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return
      setLoadMoreError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar mais itens.")
    } finally {
      if (loadAbortRef.current === controller) loadAbortRef.current = null
      loadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [optimisticFeedMode, searchQuery])

  const setThreadRailPillState = useCallback((pill: ThreadRailPill) => {
    threadRailPillRef.current = pill
    setThreadRailPill(pill)
  }, [])

  const clearThreadRailControl = useCallback(() => {
    manualThreadRailPositionRef.current = null
    undoThreadRailPositionRef.current = null
    threadRailManualSessionRef.current = null
    setThreadRailPillState(null)
  }, [setThreadRailPillState])

  const beginThreadRailManualInteraction = useCallback(() => {
    const rail = threadRailScrollRef.current
    if (!rail) return

    threadRailAutoTargetRef.current = null
    threadRailManualInputRef.current = true
    if (threadRailManualInputTimerRef.current) clearTimeout(threadRailManualInputTimerRef.current)
    threadRailManualInputTimerRef.current = setTimeout(() => {
      threadRailManualInputRef.current = false
      threadRailManualInputTimerRef.current = null
    }, 400)

    if (threadRailPillRef.current === "return") {
      manualThreadRailPositionRef.current = null
      undoThreadRailPositionRef.current = null
      threadRailManualSessionRef.current = null
    }
    if (threadRailPillRef.current) {
      setThreadRailPillState(null)
    }

    if (!threadRailManualSessionRef.current) {
      threadRailManualSessionRef.current = {
        origin: threadRailLastScrollTopRef.current,
        threshold: threadSpanAtScrollPosition(rail, threadRailLastScrollTopRef.current),
        qualified: false,
      }
    }
  }, [setThreadRailPillState])

  const handleThreadRailKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) {
      beginThreadRailManualInteraction()
    }
  }, [beginThreadRailManualInteraction])

  const updateThreadRailOverflow = useCallback(() => {
    const rail = threadRailScrollRef.current
    if (!rail) return

    const viewportInset = 16
    const railTop = Math.max(viewportInset, rail.getBoundingClientRect().top)
    const availableHeight = Math.max(192, window.innerHeight - railTop - viewportInset)
    rail.style.maxHeight = `${Math.floor(availableHeight)}px`

    const hasOverflow = rail.scrollHeight > rail.clientHeight + 1
    const atEnd = rail.scrollTop + rail.clientHeight >= rail.scrollHeight - 2
    setThreadRailOverflow(hasOverflow)
    setThreadRailAtEnd(!hasOverflow || atEnd)
  }, [])

  const syncThreadRailToPrimaryScroll = useCallback((fromPrimaryScroll = false, force = false) => {
    const primary = primaryFeedRef.current
    const rail = threadRailScrollRef.current
    if (!primary || !rail || !isDualTimelineViewport || desktopThreadItems.length === 0) return

    const primaryTop = primary.getBoundingClientRect().top + window.scrollY
    const primaryProgress = Math.max(0, window.scrollY + 16 - primaryTop)
    const threadElements = Array.from(
      rail.querySelectorAll<HTMLElement>("[data-thread-index]")
    )
    if (threadElements.length === 0) return

    const firstThreadOffset = threadElements[0].offsetTop
    let targetIndex = 0
    for (let index = 1; index < threadElements.length; index += 1) {
      const threadStart = threadElements[index].offsetTop - firstThreadOffset
      if (primaryProgress < threadStart) break
      targetIndex = index
    }
    const target = threadElements[targetIndex]
    const targetTop = target.offsetTop - firstThreadOffset
    const nextTarget = threadElements[targetIndex + 1]
    const targetBottom = nextTarget
      ? nextTarget.offsetTop - firstThreadOffset
      : Number.POSITIVE_INFINITY
    const requiresImmediateResync = threadRailNeedsImmediateResyncRef.current

    if (manualThreadRailPositionRef.current) {
      if (threadRailManualInputRef.current) return

      const targetChanged = targetIndex !== lastSyncedThreadIndexRef.current
      if (!fromPrimaryScroll || !targetChanged) return

      if (rail.scrollTop >= targetTop - 2 && rail.scrollTop < targetBottom - 2) {
        undoThreadRailPositionRef.current = manualThreadRailPositionRef.current
        manualThreadRailPositionRef.current = null
        threadRailManualSessionRef.current = null
        lastSyncedThreadIndexRef.current = targetIndex
        setThreadRailPillState("return")
        return
      }

      undoThreadRailPositionRef.current = manualThreadRailPositionRef.current
      manualThreadRailPositionRef.current = null
      threadRailManualSessionRef.current = null
      lastSyncedThreadIndexRef.current = targetIndex
      threadRailAutoTargetRef.current = targetTop
      setThreadRailPillState("return")
      rail.scrollTo({
        top: targetTop,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })
      return
    }

    const targetChanged = targetIndex !== lastSyncedThreadIndexRef.current
    if (!force && !targetChanged && !requiresImmediateResync) return
    if (threadRailAutoTargetRef.current === targetTop) return

    threadRailNeedsImmediateResyncRef.current = false
    lastSyncedThreadIndexRef.current = targetIndex
    threadRailAutoTargetRef.current = targetTop
    rail.scrollTo({
      top: targetTop,
      behavior: requiresImmediateResync || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    })
  }, [desktopThreadItems.length, isDualTimelineViewport, setThreadRailPillState])

  const returnToSavedThreadPosition = useCallback(() => {
    const rail = threadRailScrollRef.current
    const savedPosition = undoThreadRailPositionRef.current
    if (!rail || !savedPosition) {
      clearThreadRailControl()
      return
    }

    const targetTop = resolveThreadRailPosition(rail, savedPosition)
    manualThreadRailPositionRef.current = savedPosition
    undoThreadRailPositionRef.current = null
    threadRailManualSessionRef.current = {
      origin: targetTop,
      threshold: threadSpanAtScrollPosition(rail, targetTop),
      qualified: true,
    }
    setThreadRailPillState(null)
    threadRailAutoTargetRef.current = targetTop
    rail.scrollTo({
      top: targetTop,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    })
  }, [clearThreadRailControl, setThreadRailPillState])

  const dismissThreadRailPill = useCallback(() => {
    clearThreadRailControl()
  }, [clearThreadRailControl])

  const handleThreadRailScroll = useCallback(() => {
    updateThreadRailOverflow()
    const rail = threadRailScrollRef.current
    if (!rail) return

    if (threadRailManualInputRef.current) {
      if (threadRailManualInputTimerRef.current) clearTimeout(threadRailManualInputTimerRef.current)
      threadRailManualInputTimerRef.current = setTimeout(() => {
        threadRailManualInputRef.current = false
        threadRailManualInputTimerRef.current = null
      }, 400)
      threadRailAutoTargetRef.current = null
      const session = threadRailManualSessionRef.current
      if (session) {
        if (Math.abs(rail.scrollTop - session.origin) >= session.threshold) {
          session.qualified = true
        }
        if (session.qualified) {
          manualThreadRailPositionRef.current = captureThreadRailPosition(rail)
        }
      }
    } else {
      const autoTarget = threadRailAutoTargetRef.current
      if (autoTarget !== null && Math.abs(rail.scrollTop - autoTarget) <= 2) {
        threadRailAutoTargetRef.current = null
      }
    }

    threadRailLastScrollTopRef.current = rail.scrollTop
    if (!hasMoreThreadItems) return
    const remaining = rail.scrollHeight - rail.scrollTop - rail.clientHeight
    if (remaining <= rail.clientHeight * 0.75) void loadNextPage()
  }, [hasMoreThreadItems, loadNextPage, updateThreadRailOverflow])

  useEffect(() => {
    const rail = threadRailScrollRef.current
    if (!rail) return
    const handleRailResize = () => {
      updateThreadRailOverflow()
      const manualPosition = manualThreadRailPositionRef.current
      if (!manualPosition || threadRailManualInputRef.current) return
      const preservedTop = resolveThreadRailPosition(rail, manualPosition)
      if (Math.abs(rail.scrollTop - preservedTop) <= 2) return
      rail.scrollTop = preservedTop
      threadRailLastScrollTopRef.current = preservedTop
    }
    const frame = window.requestAnimationFrame(handleRailResize)
    const observer = new ResizeObserver(handleRailResize)
    observer.observe(rail)
    if (rail.firstElementChild) observer.observe(rail.firstElementChild)
    window.addEventListener("resize", handleRailResize)
    window.addEventListener("scroll", updateThreadRailOverflow, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", handleRailResize)
      window.removeEventListener("scroll", updateThreadRailOverflow)
    }
  }, [desktopRailNotes, updateThreadRailOverflow])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => syncThreadRailToPrimaryScroll(false))
    const handlePrimaryScroll = () => syncThreadRailToPrimaryScroll(true)
    window.addEventListener("scroll", handlePrimaryScroll, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", handlePrimaryScroll)
    }
  }, [syncThreadRailToPrimaryScroll])

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel || !hasMorePrimaryItems) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadNextPage()
      },
      { rootMargin: "600px 0px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMorePrimaryItems, loadNextPage])

  useEffect(() => {
    const rail = threadRailScrollRef.current
    if (!rail || !hasMoreThreadItems || !isDualTimelineViewport) return
    const frame = window.requestAnimationFrame(() => {
      if (rail.scrollHeight <= rail.clientHeight + 1) void loadNextPage()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [desktopRailNotes, hasMoreThreadItems, isDualTimelineViewport, loadNextPage])

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      if (threadRailManualInputTimerRef.current) clearTimeout(threadRailManualInputTimerRef.current)
      loadAbortRef.current?.abort()
    }
  }, [])

  const applySearch = useCallback((value: string) => {
    const normalizedQuery = normalizeSearchQuery(value)
    if (normalizedQuery === searchQuery) return
    lastRequestedSearchRef.current = normalizedQuery

    startNavigationTransition(() => {
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
    const initializedThread = Boolean(threadParent && !threadParent.thread && note.thread)
    setNotes((prev) => [
      note,
      ...prev.map((existing) => (
        threadParent && existing._id === threadParent._id && !existing.thread && note.thread
          ? { ...existing, thread: { rootId: existing._id, position: 1 } }
          : existing
      )),
    ])
    setNoteCount((prev) => prev + 1)
    if (note.thread) {
      setDesktopRailNotes((current) => {
        const normalizedParent = threadParent && initializedThread
          ? { ...threadParent, thread: { rootId: threadParent._id, position: 1 } }
          : threadParent
        const withParent = normalizedParent && !current.some((existing) => existing._id === normalizedParent._id)
          ? [...current, normalizedParent]
          : current
        return mergeNotesById(withParent, [note])
      })
      if (threadParent) {
        setDesktopTimelineNotes((current) => current.filter((existing) => existing._id !== threadParent._id))
      }
      if (initializedThread) {
        setDesktopTimelineNoteCount((current) => Math.max(0, current - 1))
        setDesktopRailThreadCount((current) => current + 1)
      }
    } else {
      setDesktopTimelineNotes((current) => [note, ...current])
      setDesktopTimelineNoteCount((current) => current + 1)
    }
    setThreadParent(null)
  }

  function handleContinueThread(note: SerializedNote) {
    setNoteError("")
    setThreadParent(note)
  }

  async function handleLinkToThread(note: SerializedNote) {
    if (!threadParent || linkingNoteId) return
    setLinkingNoteId(note._id)
    setNoteError("")

    try {
      const response = await fetch(`/api/admin/notes/${note._id}/thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceNoteId: threadParent._id }),
      })
      const data = await response.json().catch(() => null) as { error?: string; thread?: SerializedNote[] } | null
      if (!response.ok || !Array.isArray(data?.thread)) {
        throw new Error(data?.error ?? "Não foi possível linkar a nota à thread.")
      }
      setNotes((current) => mergeNotesById(current, data.thread!))
      setDesktopRailNotes((current) => mergeNotesById(current, data.thread!))
      const linkedIds = new Set(data.thread.map((threadNote) => threadNote._id))
      setDesktopTimelineNotes((current) => current.filter((existing) => !linkedIds.has(existing._id)))
      setDesktopTimelineNoteCount((current) => Math.max(0, current - (threadParent.thread ? 1 : 2)))
      if (!threadParent.thread) setDesktopRailThreadCount((current) => current + 1)
      setThreadParent(null)
    } catch (caughtError) {
      setNoteError(caughtError instanceof Error ? caughtError.message : "Não foi possível linkar a nota à thread.")
    } finally {
      setLinkingNoteId(null)
    }
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
      const data = await response.json().catch(() => null) as { thread?: SerializedNote[] } | null
      setNotes((prev) => {
        const removed = prev.find((note) => note._id === id)
        const replacements = new Map((data?.thread ?? []).map((note) => [note._id, note]))
        return prev
          .filter((note) => note._id !== id)
          .map((note) => removed?.thread?.rootId === note.thread?.rootId
            ? replacements.get(note._id) ?? note
            : note)
      })
      setDesktopTimelineNotes((current) => current
        .filter((note) => note._id !== id)
        .map((note) => data?.thread?.find((replacement) => replacement._id === note._id) ?? note))
      setDesktopRailNotes((current) => current
        .filter((note) => note._id !== id)
        .map((note) => data?.thread?.find((replacement) => replacement._id === note._id) ?? note))
      if (threadParent?._id === id) setThreadParent(null)
      setNoteCount((prev) => Math.max(0, prev - 1))
      router.refresh()
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Não foi possível deletar a nota."
      setNoteError(message)
      throw new Error(message)
    } finally {
      setDeletingNoteId(null)
    }
  }

  function handleUpdate(updatedNote: SerializedNote) {
    setNotes((prev) => prev.map((note) => note._id === updatedNote._id ? updatedNote : note))
    setDesktopTimelineNotes((current) => current.map((note) => note._id === updatedNote._id ? updatedNote : note))
    setDesktopRailNotes((current) => current.map((note) => note._id === updatedNote._id ? updatedNote : note))
  }

  async function handleHidePost(postToHide: SerializedPostSummary) {
    if (!isAdmin || hidingPostId) return
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
      setDesktopTimelinePosts((prev) => prev.filter((post) => post._id !== postToHide._id))
      setPostCount((prev) => Math.max(0, prev - 1))
      setDesktopTimelinePostCount((prev) => Math.max(0, prev - 1))
      router.refresh()
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Não foi possível esconder o post."
      setHideError(message)
      throw new Error(message)
    } finally {
      setHidingPostId(null)
    }
  }

  async function handleDeletePost(postToDelete: SerializedPostSummary) {
    if (!isAdmin || deletingPostId) return
    setDeletingPostId(postToDelete._id)
    setHideError("")

    try {
      const response = await fetch(`/api/admin/posts/${postToDelete._id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? "Não foi possível excluir o post.")
      }

      setTimelinePosts((current) => current.filter((post) => post._id !== postToDelete._id))
      setDesktopTimelinePosts((current) => current.filter((post) => post._id !== postToDelete._id))
      setPostCount((current) => Math.max(0, current - 1))
      setDesktopTimelinePostCount((current) => Math.max(0, current - 1))
      router.refresh()
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Não foi possível excluir o post."
      setHideError(message)
      throw new Error(message)
    } finally {
      setDeletingPostId(null)
    }
  }

  function scrollToTimelineStart() {
    sectionRef.current?.scrollIntoView({ block: "start" })
  }

  function switchMode(nextMode: FeedMode) {
    const currentInputQuery = normalizeSearchQuery(searchInput)
    if (nextMode === optimisticFeedMode && currentInputQuery === searchQuery) {
      scrollToTimelineStart()
      return
    }

    startNavigationTransition(() => {
      router.push(modeHref(nextMode, currentInputQuery), { scroll: false })
    })
    scrollToTimelineStart()
  }

  const swipeNavigation = useTimelineSwipeNavigation(optimisticFeedMode, switchMode)

  const modeOptions = [
    { mode: "all" as const, label: "Tudo", count: timelineCount },
    { mode: "posts" as const, label: "Posts", count: postCount },
    { mode: "notes" as const, label: "Notas", count: noteCount },
  ]
  const searchPlaceholder = optimisticFeedMode === "posts"
    ? "Pesquisar posts..."
    : optimisticFeedMode === "notes"
      ? "Pesquisar notas..."
      : "Pesquisar..."
  const searchLabel = optimisticFeedMode === "posts"
    ? "Pesquisar posts"
    : optimisticFeedMode === "notes"
      ? "Pesquisar notas"
      : "Pesquisar posts e notas"
  const hasDesktopThreads = desktopThreadItems.length > 0
  const hasDesktopStandaloneItems = desktopVisibleItems.length > 0

  function renderNoteGroup(
    item: Extract<TimelineDisplayItem, { type: "note-group" }>,
    surface: "timeline" | "thread-rail"
  ) {
    return (
      <NoteTimelineGroup notes={item.notes}>
        {(note, placement, threadSize) => (
          <NoteCard
            note={note}
            viewContext="home"
            isAdmin={isAdmin}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onContinueThread={handleContinueThread}
            deleting={deletingNoteId === note._id}
            cropTallImages
            timelineThreadPlacement={placement}
            timelineThreadSize={threadSize}
            showThreadLabel={item.notes.length === 1}
            threadLinkSource={threadParent}
            onLinkToThread={handleLinkToThread}
            onCancelThreadLink={() => setThreadParent(null)}
            linkingToThread={linkingNoteId === note._id}
            commentsPanelMode={surface === "thread-rail" ? "viewport" : "adjacent"}
            showTimelineBoundaries={false}
          />
        )}
      </NoteTimelineGroup>
    )
  }

  function renderTimelineItems(items: TimelineDisplayItem[]) {
    return (
      <ul className="ml-0 min-w-0 divide-y divide-neutral-200 dark:divide-white/10">
        {items.map((item) => (
          item.type === "note-group" ? (
            <li key={item.id} className="min-w-0">
              {renderNoteGroup(item, "timeline")}
            </li>
          ) : (
            <PostTimelineItem
              key={item.id}
              post={item.post}
              isAdmin={isAdmin}
              onHide={handleHidePost}
              onDelete={handleDeletePost}
              hiding={hidingPostId === item.post._id}
              deleting={deletingPostId === item.post._id}
            />
          )
        ))}
      </ul>
    )
  }

  return (
    <section
      ref={sectionRef}
      aria-label="Timeline"
      aria-busy={isNavigationPending || isLoadingMore}
      className={[
        "flex w-full min-w-0 touch-pan-y flex-col gap-5 self-center",
        hasDesktopThreads
          ? "home-timeline-dual min-[84rem]:w-[calc(50vw+14.25rem)] min-[84rem]:self-start min-[96rem]:w-[calc(50vw+13.25rem)] min-[96.5rem]:w-[61.5rem]"
          : "",
      ].join(" ")}
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

      <div className={[
        "flex min-w-0 flex-col gap-5",
        hasDesktopThreads
          ? "home-timeline-dual-grid min-[84rem]:grid min-[84rem]:translate-x-[calc(-17.5vw+6.0375rem)] min-[84rem]:grid-cols-[34.5rem_minmax(0,1fr)] min-[84rem]:items-start min-[84rem]:gap-8 min-[96rem]:gap-12"
          : "",
      ].join(" ")}>
        <div className="home-timeline-primary-column flex min-w-0 flex-col gap-5">
          <div className="home-timeline-dual-search-row flex flex-col gap-3">
            <div className="flex min-w-0 flex-col items-start gap-3">
              <form
                action="/"
                className="home-timeline-dual-search w-[min(100%,14rem)] min-w-0 sm:w-56"
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
                    placeholder={searchPlaceholder}
                    aria-label={searchLabel}
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

        {isAdmin && (
          <div>
            <NoteComposer
              onPosted={handlePosted}
              threadParent={threadParent}
              onCancelThread={() => setThreadParent(null)}
            />
          </div>
        )}
        {hideError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{hideError}</p>}
        {noteError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{noteError}</p>}
        {searchError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{searchError}</p>}
        {isNavigationPending && <p role="status" className="sr-only">Atualizando a timeline...</p>}

        <div
          ref={primaryFeedRef}
          className="min-w-0 will-change-transform motion-reduce:!translate-x-0 motion-reduce:!opacity-100 motion-reduce:!transition-none"
          style={{
            opacity: 1 - Math.min(Math.abs(swipeNavigation.swipeOffset) / 420, 0.18),
            transform: `translate3d(${swipeNavigation.swipeOffset}px, 0, 0)`,
            transition: swipeNavigation.isSwipeSettling ? "transform 120ms cubic-bezier(0.16, 1, 0.3, 1), opacity 100ms ease-out" : "none",
          }}
        >
          <div className="home-timeline-single-feed min-[84rem]:hidden">
            {visibleItems.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                <p>{hasSearch ? "Nenhum resultado encontrado." : "Nenhum post ou nota publicado ainda."}</p>
              </div>
            ) : renderTimelineItems(visibleItems)}
          </div>

          <div className="home-timeline-standalone-feed hidden min-[84rem]:block">
            {hasDesktopStandaloneItems ? renderTimelineItems(desktopVisibleItems) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {hasSearch ? "Nenhum resultado encontrado na timeline." : "Nenhum post ou nota solta nesta página."}
              </p>
            )}
          </div>

          <div
            ref={loadMoreSentinelRef}
            className="flex min-h-20 flex-col items-center justify-center border-t border-neutral-200 pt-4 dark:border-white/10"
          >
            {loadMoreError ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <p role="alert" className="text-sm text-red-700 dark:text-red-300">{loadMoreError}</p>
                <button
                  type="button"
                  data-swipe-ignore
                  onClick={() => void loadNextPage()}
                  className="min-h-10 rounded-md px-3 text-sm text-neutral-700 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#c2bbb1] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
                >
                  Tentar novamente
                </button>
              </div>
            ) : hasMoreTimelineItems ? (
              <button
                type="button"
                data-swipe-ignore
                onClick={() => void loadNextPage()}
                disabled={isLoadingMore}
                aria-live="polite"
                className="min-h-10 rounded-md px-3 text-sm text-neutral-600 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-wait disabled:opacity-60 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100 dark:focus-visible:ring-neutral-300"
              >
                {isLoadingMore ? "Carregando…" : "Carregar mais"}
              </button>
            ) : (visibleItems.length > 0 || desktopVisibleItems.length > 0) ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-500">Fim da timeline.</p>
            ) : null}
          </div>
        </div>
        </div>

        {hasDesktopThreads && (
          <aside
            aria-label={`Threads da timeline, ${desktopRailThreadCount} no total`}
            className="home-timeline-thread-rail relative hidden min-w-0 self-start min-[84rem]:sticky min-[84rem]:top-4 min-[84rem]:block"
          >
            <div
              ref={threadRailScrollRef}
              data-thread-rail
              tabIndex={threadRailOverflow ? 0 : -1}
              onScroll={handleThreadRailScroll}
              onWheelCapture={beginThreadRailManualInteraction}
              onPointerDownCapture={beginThreadRailManualInteraction}
              onTouchStartCapture={beginThreadRailManualInteraction}
              onKeyDown={handleThreadRailKeyDown}
              className="timeline-thread-scroll overflow-y-auto pr-2 outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:focus-visible:ring-neutral-300"
            >
              <ol className="ml-0 flex min-w-0 flex-col divide-y divide-neutral-200 dark:divide-white/10">
                {desktopThreadItems.map((item, index) => (
                  item.type === "note-group" && (
                    <li
                      key={`rail:${item.id}`}
                      data-thread-index={index}
                      data-thread-id={item.id}
                      className="min-w-0 scroll-mt-1"
                    >
                      {renderNoteGroup(item, "thread-rail")}
                    </li>
                  )
                ))}
              </ol>
            </div>
            {threadRailOverflow && (
              <div
                aria-hidden
                className="absolute right-0 top-0 z-10 size-2 bg-[#f4f4f4] dark:bg-[#040404]"
              />
            )}
            <div
              aria-hidden
              className={[
                "pointer-events-none absolute inset-x-[-1rem] bottom-0 h-16 bg-gradient-to-t from-[#f4f4f4] via-[#f4f4f4]/90 to-transparent transition-opacity duration-150 dark:from-[#040404] dark:via-[#040404]/90",
                threadRailOverflow && !threadRailAtEnd ? "opacity-100" : "opacity-0",
              ].join(" ")}
            />
            {threadRailPill && (
              <div
                aria-live="polite"
                className="pointer-events-none absolute inset-x-3 bottom-4 z-20 flex justify-center"
              >
                <div className="pointer-events-auto inline-flex max-w-full items-center rounded-full border border-neutral-200 bg-white p-0.5 text-neutral-800 shadow-[0_3px_8px_rgb(0_0_0_/_0.12)] dark:border-white/10 dark:bg-[#0b0b0b] dark:text-[#d8d4ce] dark:shadow-[0_3px_8px_rgb(0_0_0_/_0.35)]">
                  <button
                    type="button"
                    data-thread-return-pill
                    data-thread-pill={threadRailPill}
                    onClick={returnToSavedThreadPosition}
                    className="flex min-h-10 min-w-0 items-center gap-1.5 truncate rounded-l-full px-3 text-[11px] font-medium transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500 dark:hover:bg-white/[0.07] dark:focus-visible:ring-neutral-300"
                  >
                    <ArrowUturnLeftIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">Voltar para onde você estava</span>
                  </button>
                  <span className="h-4 w-px shrink-0 bg-neutral-200 dark:bg-white/10" aria-hidden />
                  <button
                    type="button"
                    data-thread-pill-dismiss
                    onClick={dismissThreadRailPill}
                    aria-label="Manter sincronização"
                    className="grid size-10 shrink-0 place-items-center rounded-r-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500 dark:text-[#A8A095] dark:hover:bg-white/[0.07] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
                  >
                    <XMarkIcon className="size-3.5" strokeWidth={1.7} aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  )
}
