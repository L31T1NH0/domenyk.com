import type { Metadata } from "next"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { getNotes, serializeNote } from "@/lib/db/notes"
import { isAdmin } from "@/lib/auth"
import { Header } from "@/components/Header"
import { HomeTimeline } from "./HomeTimeline"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata()

const HOME_TIMELINE_PAGE_SIZE = 10
const HOME_TIMELINE_FETCH_LIMIT = 1000
const FEED_MODES = ["all", "posts", "notes"] as const
type FeedMode = (typeof FEED_MODES)[number]

function parsePage(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(page) && page > 0 ? Math.min(page, 500) : 1
}

function parseFeedMode(value: string | string[] | undefined): FeedMode {
  const mode = Array.isArray(value) ? value[0] : value
  return FEED_MODES.includes(mode as FeedMode) ? mode as FeedMode : "all"
}

function parseSearchQuery(value: string | string[] | undefined) {
  const query = (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
  return query.replace(/\s+/g, " ").slice(0, 120)
}

function noteMatchesQuery(note: ReturnType<typeof serializeNote>, query: string) {
  const normalized = query.toLowerCase()
  return note.content.toLowerCase().includes(normalized)
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; mode?: string | string[]; q?: string | string[] }>
}) {
  const params = await searchParams
  const requestedPage = parsePage(params.page)
  const feedMode = parseFeedMode(params.mode)
  const searchQuery = parseSearchQuery(params.q)
  const admin = await isAdmin()
  const [{ posts, total }, { notes, total: totalNotes }] = await Promise.all([
    getPosts({
      limit: HOME_TIMELINE_FETCH_LIMIT,
      excludeHiddenFromTimeline: true,
      search: searchQuery || undefined,
    }),
    getNotes({ limit: HOME_TIMELINE_FETCH_LIMIT }),
  ])
  const serializedNotes = notes.map(serializeNote)
  const filteredNotes = searchQuery
    ? serializedNotes.filter((note) => noteMatchesQuery(note, searchQuery))
    : serializedNotes
  const activeNoteTotal = searchQuery ? filteredNotes.length : totalNotes
  const totalItems = total + activeNoteTotal
  const activeTotal = feedMode === "posts" ? total : feedMode === "notes" ? activeNoteTotal : totalItems
  const totalPages = Math.max(1, Math.ceil(activeTotal / HOME_TIMELINE_PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)

  return (
    <>
      <Header />
      <section className="flex flex-col items-center gap-1 pb-4 text-center">
        <p className="w-full max-w-[22rem] text-[15px] leading-relaxed text-neutral-600 dark:text-zinc-400">Ideias, e somente ideias, podem iluminar a escuridão.</p>
      </section>

      <HomeTimeline
        key={`${feedMode}:${currentPage}:${searchQuery}`}
        posts={posts.map(serializePostSummary)}
        totalPosts={total}
        totalNotes={activeNoteTotal}
        initialNotes={filteredNotes}
        feedMode={feedMode}
        searchQuery={searchQuery}
        currentPage={currentPage}
        pageSize={HOME_TIMELINE_PAGE_SIZE}
        totalPages={totalPages}
        isAdmin={admin}
      />
    </>
  )
}
