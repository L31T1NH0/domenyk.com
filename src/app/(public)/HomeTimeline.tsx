"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { EyeIcon } from "@heroicons/react/24/outline"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { NoteCard } from "@/components/notes/NoteCard"
import { NoteComposer } from "@/components/notes/NoteComposer"
import type { SerializedNote } from "@/lib/db/notes"
import type { SerializedPostSummary } from "@/lib/db/posts"

type Props = {
  posts: SerializedPostSummary[]
  totalPosts: number
  initialNotes: SerializedNote[]
  initialCursor: string | null
  isAdmin: boolean
}

type TimelineItem =
  | { type: "note"; id: string; date: string; note: SerializedNote }
  | { type: "post"; id: string; date: string; post: SerializedPostSummary }

type TimelineDisplayItem =
  | TimelineItem
  | { type: "collapsed-notes"; id: string; groupId: string; date: string; notes: SerializedNote[]; expandedCount: number }
  | { type: "notes-collapse-control"; id: string; groupId: string; date: string }

type FeedMode = "all" | "posts" | "notes"
type NoteTimelineItem = Extract<TimelineItem, { type: "note" }>

const MAX_NOTES_BETWEEN_POSTS = 3

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
  return item?.type === "note" || item?.type === "collapsed-notes" || (item?.type === "post" && !postShowsTimelineCover(item.post))
}

function itemShouldHaveTopSeparator(item: TimelineDisplayItem | undefined, previousItem: TimelineDisplayItem | undefined) {
  return itemNeedsTextSeparator(item) && Boolean(previousItem) && (previousItem?.type === "note" || previousItem?.type === "collapsed-notes" || itemHasCoverPost(previousItem))
}

function limitNotesBetweenPosts(items: TimelineItem[], expandedGroups: Record<string, number>) {
  const hasPosts = items.some((item) => item.type === "post")
  if (!hasPosts) return { items, hiddenNoteCount: 0 }

  const visible: TimelineDisplayItem[] = []
  let pendingNotes: NoteTimelineItem[] = []
  let hiddenNoteCount = 0

  function flushPendingNotes() {
    if (pendingNotes.length === 0) return

    const groupId = `notes:${pendingNotes[0].note._id}`
    const expandedCount = expandedGroups[groupId] ?? 0
    const visibleCount = MAX_NOTES_BETWEEN_POSTS + expandedCount
    const visibleNotes = pendingNotes.slice(0, visibleCount)
    const hiddenNotes = pendingNotes.slice(visibleCount)

    visible.push(...visibleNotes)

    if (hiddenNotes.length > 0) {
      hiddenNoteCount += hiddenNotes.length
      visible.push({
        type: "collapsed-notes",
        id: `collapsed:${hiddenNotes[0].note._id}`,
        groupId,
        date: hiddenNotes[0].date,
        notes: hiddenNotes.map((item) => item.note),
        expandedCount,
      })
    } else if (expandedCount > 0) {
      visible.push({
        type: "notes-collapse-control",
        id: `collapse:${groupId}`,
        groupId,
        date: visibleNotes[visibleNotes.length - 1].date,
      })
    }

    pendingNotes = []
  }

  for (const item of items) {
    if (item.type === "note") {
      pendingNotes.push(item)
      continue
    }

    flushPendingNotes()
    visible.push(item)
  }

  flushPendingNotes()

  return { items: visible, hiddenNoteCount }
}

function CollapsedNotesPreview({
  notes,
  expandedCount,
  onShowMore,
  onCollapse,
}: {
  notes: SerializedNote[]
  expandedCount: number
  onShowMore: () => void
  onCollapse: () => void
}) {
  const previewNote = notes[0]
  const revealCount = Math.min(MAX_NOTES_BETWEEN_POSTS, notes.length)

  return (
    <li className="border-b border-neutral-200 pb-5 dark:border-white/10">
      <div className="relative max-h-36 overflow-hidden">
        <div className="border-y border-neutral-200 pb-6 pt-5 opacity-65 dark:border-white/10">
          <time className="text-xs text-[#A8A095]/75">
            {format(new Date(previewNote.publishedAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </time>
          <div
            className="note-content mt-3 text-[15px] leading-relaxed text-neutral-900 dark:text-[#f1f1f1]"
            dangerouslySetInnerHTML={{ __html: previewNote.contentHtml }}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent via-[#f4f4f4]/85 to-[#f4f4f4] dark:via-[#040404]/85 dark:to-[#040404]" />
      </div>
      <div className="relative -mt-7 flex justify-center gap-2">
        <button
          type="button"
          onClick={onShowMore}
          className="inline-flex h-8 items-center rounded-full border border-neutral-300 bg-white/90 px-3 text-xs font-medium text-neutral-700 shadow-sm shadow-black/10 backdrop-blur transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8A095]/35 dark:border-white/10 dark:bg-[#040404]/90 dark:text-[#A8A095] dark:shadow-black/20 dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]"
        >
          Mostrar mais {revealCount === 1 ? "1 nota" : `${revealCount} notas`}
        </button>
        {expandedCount > 0 && (
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex h-8 items-center rounded-full bg-white/80 px-3 text-xs font-medium text-neutral-600 backdrop-blur transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8A095]/35 dark:bg-[#040404]/80 dark:text-[#A8A095]/80 dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]"
          >
            Compactar
          </button>
        )}
      </div>
    </li>
  )
}

function NotesCollapseControl({ onCollapse }: { onCollapse: () => void }) {
  return (
    <li className="flex justify-center border-b border-neutral-200 py-3 dark:border-white/10">
      <button
        type="button"
        onClick={onCollapse}
        className="inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8A095]/35 dark:text-[#A8A095]/80 dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]"
      >
        Compactar notas
      </button>
    </li>
  )
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
        "group relative py-5 first:pt-0",
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
      <Link href={`/posts/${post.publicId}`} prefetch={false} className="block text-left focus-visible:outline-none">
        {showCover ? (
          <span className="relative block aspect-video w-full overflow-hidden rounded-2xl bg-neutral-200 dark:bg-white/5">
            <Image
              src={post.cover!.url}
              alt={post.cover!.alt ?? post.title}
              width={1920}
              height={1080}
              sizes="(max-width: 640px) calc(100vw - 2rem), 34rem"
              className="h-full w-full rounded-2xl object-cover !grayscale-0"
            />
            <span className="pointer-events-none absolute inset-0 rounded-2xl">
              <span className="absolute left-0 top-0 h-1/2 w-full bg-gradient-to-b from-[#040404] via-[#040404]/80 to-transparent" />
              <span className="absolute bottom-0 left-0 h-1/2 w-full bg-gradient-to-t from-[#040404] via-[#040404]/80 to-transparent" />
            </span>
            <span className="absolute bottom-2 left-3 right-3 flex flex-col gap-2 sm:bottom-3">
              <span className="text-xl font-normal leading-snug text-white">{post.title}</span>
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
            <span className="text-lg font-normal leading-snug text-neutral-950 dark:text-[#f1f1f1]">{post.title}</span>
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

export function HomeTimeline({ posts, totalPosts, initialNotes, initialCursor, isAdmin }: Props) {
  const router = useRouter()
  const [timelinePosts, setTimelinePosts] = useState(posts)
  const [postCount, setPostCount] = useState(totalPosts)
  const [notes, setNotes] = useState(initialNotes)
  const timelineCount = postCount + notes.length
  const [feedMode, setFeedMode] = useState<FeedMode>("all")
  const [expandedNoteGroups, setExpandedNoteGroups] = useState<Record<string, number>>({})
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)
  const [hidingPostId, setHidingPostId] = useState<string | null>(null)
  const [pendingHidePostId, setPendingHidePostId] = useState<string | null>(null)
  const [hideError, setHideError] = useState("")
  const pendingHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const { visibleItems } = useMemo(() => {
    if (feedMode === "posts") {
      return { visibleItems: allItems.filter((item) => item.type === "post"), hiddenNoteCount: 0 }
    }

    if (feedMode === "notes") {
      return { visibleItems: allItems.filter((item) => item.type === "note"), hiddenNoteCount: 0 }
    }

    const limited = limitNotesBetweenPosts(allItems, expandedNoteGroups)
    return { visibleItems: limited.items, hiddenNoteCount: limited.hiddenNoteCount }
  }, [allItems, expandedNoteGroups, feedMode])

  function showMoreNotesInGroup(groupId: string) {
    setExpandedNoteGroups((current) => ({
      ...current,
      [groupId]: (current[groupId] ?? 0) + MAX_NOTES_BETWEEN_POSTS,
    }))
  }

  function collapseNoteGroup(groupId: string) {
    setExpandedNoteGroups((current) => {
      const next = { ...current }
      delete next[groupId]
      return next
    })
  }

  function handlePosted(note: SerializedNote) {
    setNotes((prev) => [note, ...prev])
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/notes/${id}`, { method: "DELETE" })
    setNotes((prev) => prev.filter((note) => note._id !== id))
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

  async function loadMoreNotes() {
    if (!cursor || loading) return
    setLoading(true)
    const res = await fetch(`/api/notes?cursor=${cursor}`)
    const data = await res.json()
    setNotes((prev) => [...prev, ...data.notes])
    setCursor(data.nextCursor)
    setLoading(false)
  }

  const modeOptions = [
    { mode: "all" as const, label: "Tudo", count: timelineCount },
    { mode: "posts" as const, label: "Posts", count: postCount },
    { mode: "notes" as const, label: "Notas", count: notes.length },
  ]

  return (
    <section aria-label="Timeline" className="flex w-full flex-col gap-4 self-center">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-4">
          <h1 className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-[#f1f1f1]">
            Timeline
            <span className="tabular-nums font-normal">({timelineCount})</span>
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            {modeOptions.map((option) => {
              const active = feedMode === option.mode
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => setFeedMode(option.mode)}
                  className={[
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                    active
                      ? "border-neutral-400 bg-neutral-950/10 text-neutral-950 dark:border-[#A8A095]/60 dark:bg-[#A8A095]/15 dark:text-[#f1f1f1]"
                      : "border-neutral-300 text-neutral-600 hover:bg-neutral-950/5 hover:text-neutral-950 dark:border-white/10 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]",
                  ].join(" ")}
                >
                  {option.label}
                  <span className="tabular-nums opacity-70">{option.count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {isAdmin && <NoteComposer onPosted={handlePosted} />}
        {hideError && <p className="text-sm text-red-400">{hideError}</p>}

        {visibleItems.length === 0 ? (
          <div className="text-sm text-zinc-400">
            <p>Nenhum post ou nota publicado ainda.</p>
          </div>
        ) : (
          <ul className="ml-0">
            {visibleItems.map((item, index) => (
              item.type === "note" ? (
                <li key={item.id}>
                  <NoteCard note={item.note} isAdmin={isAdmin} onDelete={handleDelete} cropTallImages />
                </li>
              ) : item.type === "collapsed-notes" ? (
                <CollapsedNotesPreview
                  key={item.id}
                  notes={item.notes}
                  expandedCount={item.expandedCount}
                  onShowMore={() => showMoreNotesInGroup(item.groupId)}
                  onCollapse={() => collapseNoteGroup(item.groupId)}
                />
              ) : item.type === "notes-collapse-control" ? (
                <NotesCollapseControl
                  key={item.id}
                  onCollapse={() => collapseNoteGroup(item.groupId)}
                />
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

        {cursor && (
          <button
            type="button"
            onClick={loadMoreNotes}
            disabled={loading}
            className="self-center text-sm text-neutral-500 transition-colors hover:text-neutral-900 disabled:opacity-40 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            {loading ? "carregando..." : "carregar mais notas"}
          </button>
        )}
      </div>
    </section>
  )
}
