import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { countPosts, getPosts, serializePostSummary, type SerializedPostSummary } from "@/lib/db/posts"
import { countNotes, getNotes, serializeNote, type SerializedNote } from "@/lib/db/notes"
import {
  countStandaloneNotes,
  getNoteThreadPage,
  getStandaloneTimelinePage,
  getTimelinePage,
} from "@/lib/db/timeline"
import { isAdmin } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentityFromHeaders } from "@/lib/request-identity"
import { HomeTimeline } from "./HomeTimeline"
import { buildPageMetadata } from "@/lib/seo"
import {
  getCachedDesktopHomeFeed,
  getCachedHomeFeed,
  getCachedPublicContentCounts,
} from "@/lib/public-content-cache"

const HOME_TIMELINE_PAGE_SIZE = 10
const MAX_TIMELINE_PAGE = 10_000
const FEED_MODES = ["all", "posts", "notes"] as const
type FeedMode = (typeof FEED_MODES)[number]

function parsePage(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(page) && page > 0 ? Math.min(page, MAX_TIMELINE_PAGE) : 1
}

function parseFeedMode(value: string | string[] | undefined): FeedMode {
  const mode = Array.isArray(value) ? value[0] : value
  return FEED_MODES.includes(mode as FeedMode) ? mode as FeedMode : "all"
}

function parseSearchQuery(value: string | string[] | undefined) {
  const query = (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
  return query.replace(/\s+/g, " ").slice(0, 120)
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; mode?: string | string[]; q?: string | string[] }>
}): Promise<Metadata> {
  const params = await searchParams
  const page = parsePage(params.page)
  const mode = parseFeedMode(params.mode)
  const query = parseSearchQuery(params.q)
  const isFiltered = Boolean(query) || mode !== "all"
  const path = !isFiltered && page > 1 ? `/?page=${page}` : "/"
  const pageMetadata = buildPageMetadata({
    title: page > 1 && !isFiltered ? `Página ${page}` : undefined,
    path,
  })

  if (!isFiltered) return pageMetadata
  return {
    ...pageMetadata,
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },
  }
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
  const searchAllowed = !searchQuery || await rateLimit(
    `home-search:${requestIdentityFromHeaders(await headers())}`,
    { limit: 30, windowMs: 60_000 }
  )
  const effectiveSearch = searchAllowed ? searchQuery : ""
  const searchError = searchAllowed ? "" : "Muitas buscas. Aguarde um instante e tente novamente."

  const adminPromise = isAdmin()
  let totalPosts: number
  let totalNotes: number
  let serializedPosts
  let serializedNotes
  let desktopPosts: SerializedPostSummary[] = []
  let desktopNotes: SerializedNote[] = []
  let desktopThreadNotes: SerializedNote[] = []
  let desktopPostCount = 0
  let desktopLooseNoteCount = 0
  let desktopThreadCount = 0

  if (!effectiveSearch) {
    const counts = await getCachedPublicContentCounts()
    totalPosts = counts.totalPosts
    totalNotes = counts.totalNotes
  } else {
    [totalPosts, totalNotes] = await Promise.all([
      countPosts({ excludeHiddenFromTimeline: true, search: effectiveSearch }),
      countNotes(effectiveSearch),
    ])
  }
  const activeTotal = feedMode === "posts"
    ? totalPosts
    : feedMode === "notes"
      ? totalNotes
      : totalPosts + totalNotes
  const totalPages = Math.max(1, Math.ceil(activeTotal / HOME_TIMELINE_PAGE_SIZE))
  if (requestedPage > totalPages) notFound()
  const currentPage = requestedPage

  let posts = [] as Awaited<ReturnType<typeof getPosts>>["posts"]
  let notes = [] as Awaited<ReturnType<typeof getNotes>>["notes"]

  if (!effectiveSearch) {
    const [cached, desktop] = await Promise.all([
      getCachedHomeFeed(currentPage, feedMode, HOME_TIMELINE_PAGE_SIZE),
      getCachedDesktopHomeFeed(currentPage, feedMode, HOME_TIMELINE_PAGE_SIZE),
    ])
    serializedPosts = cached.posts
    serializedNotes = cached.notes
    desktopPosts = desktop.posts
    desktopNotes = desktop.notes
    desktopThreadNotes = desktop.threadNotes
    desktopPostCount = desktop.postCount
    desktopLooseNoteCount = desktop.looseNoteCount
    desktopThreadCount = desktop.threadCount
  } else if (feedMode === "all") {
    const entries = await getTimelinePage({
      page: currentPage,
      limit: HOME_TIMELINE_PAGE_SIZE,
      search: effectiveSearch || undefined,
    })
    posts = entries.filter((entry) => entry.type === "post").map((entry) => entry.post)
    notes = entries.filter((entry) => entry.type === "note").map((entry) => entry.note)
  } else if (feedMode === "posts") {
    posts = (await getPosts({
      page: currentPage,
      limit: HOME_TIMELINE_PAGE_SIZE,
      excludeHiddenFromTimeline: true,
      search: effectiveSearch || undefined,
    })).posts
  } else {
    notes = (await getNotes({
      page: currentPage,
      limit: HOME_TIMELINE_PAGE_SIZE,
      search: effectiveSearch || undefined,
    })).notes
  }

  if (effectiveSearch) {
    const [desktopEntries, standalonePostCount, standaloneNoteCount, threadPage] = await Promise.all([
      getStandaloneTimelinePage({
        page: currentPage,
        limit: HOME_TIMELINE_PAGE_SIZE,
        search: effectiveSearch,
        mode: feedMode,
      }),
      feedMode === "notes"
        ? Promise.resolve(0)
        : countPosts({ excludeHiddenFromTimeline: true, search: effectiveSearch }),
      feedMode === "posts" ? Promise.resolve(0) : countStandaloneNotes(effectiveSearch),
      feedMode === "posts"
        ? Promise.resolve({ threads: [], total: 0 })
        : getNoteThreadPage({ page: currentPage, limit: HOME_TIMELINE_PAGE_SIZE, search: effectiveSearch }),
    ])
    desktopPosts = desktopEntries
      .filter((entry) => entry.type === "post")
      .map((entry) => serializePostSummary(entry.post))
    desktopNotes = desktopEntries
      .filter((entry) => entry.type === "note")
      .map((entry) => serializeNote(entry.note))
    desktopThreadNotes = threadPage.threads.flat().map(serializeNote)
    desktopPostCount = standalonePostCount
    desktopLooseNoteCount = standaloneNoteCount
    desktopThreadCount = threadPage.total
  }

  const admin = await adminPromise
  return (
    <HomeTimeline
      key={`${feedMode}:${currentPage}:${searchQuery}`}
      posts={serializedPosts ?? posts.map((post) => serializePostSummary(post))}
      totalPosts={totalPosts}
      totalNotes={totalNotes}
      initialNotes={serializedNotes ?? notes.map(serializeNote)}
      desktopPosts={desktopPosts}
      desktopNotes={desktopNotes}
      desktopThreadNotes={desktopThreadNotes}
      desktopPostCount={desktopPostCount}
      desktopLooseNoteCount={desktopLooseNoteCount}
      desktopThreadCount={desktopThreadCount}
      feedMode={feedMode}
      searchQuery={searchQuery}
      searchError={searchError}
      currentPage={currentPage}
      pageSize={HOME_TIMELINE_PAGE_SIZE}
      isAdmin={admin}
    />
  )
}
