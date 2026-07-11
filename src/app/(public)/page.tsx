import type { Metadata } from "next"
import { headers } from "next/headers"
import { countPosts, getPosts, serializePostSummary } from "@/lib/db/posts"
import { countNotes, getNotes, serializeNote } from "@/lib/db/notes"
import { getTimelinePage } from "@/lib/db/timeline"
import { isAdmin } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentityFromHeaders } from "@/lib/request-identity"
import { Header } from "@/components/Header"
import { HomeTimeline } from "./HomeTimeline"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata()

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; mode?: string | string[]; q?: string | string[] }>
}) {
  const params = await searchParams
  const requestedPage = parsePage(params.page)
  const feedMode = parseFeedMode(params.mode)
  const searchQuery = parseSearchQuery(params.q)
  const requestHeaders = await headers()
  const searchAllowed = !searchQuery || await rateLimit(
    `home-search:${requestIdentityFromHeaders(requestHeaders)}`,
    { limit: 30, windowMs: 60_000 }
  )
  const effectiveSearch = searchAllowed ? searchQuery : ""
  const searchError = searchAllowed ? "" : "Muitas buscas. Aguarde um instante e tente novamente."

  const adminPromise = isAdmin()
  const [totalPosts, totalNotes] = await Promise.all([
    countPosts({ excludeHiddenFromTimeline: true, search: effectiveSearch || undefined }),
    countNotes(effectiveSearch || undefined),
  ])
  const activeTotal = feedMode === "posts"
    ? totalPosts
    : feedMode === "notes"
      ? totalNotes
      : totalPosts + totalNotes
  const totalPages = Math.max(1, Math.ceil(activeTotal / HOME_TIMELINE_PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)

  let posts = [] as Awaited<ReturnType<typeof getPosts>>["posts"]
  let notes = [] as Awaited<ReturnType<typeof getNotes>>["notes"]

  if (feedMode === "all") {
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

  const admin = await adminPromise
  return (
    <>
      <Header />
      <section className="flex flex-col items-center gap-1 pb-4 text-center">
        <p className="w-full max-w-[22rem] text-[15px] leading-relaxed text-neutral-600 dark:text-zinc-400">Ideias, e somente ideias, podem iluminar a escuridão.</p>
      </section>

      <HomeTimeline
        key={`${feedMode}:${currentPage}:${searchQuery}`}
        posts={posts.map(serializePostSummary)}
        totalPosts={totalPosts}
        totalNotes={totalNotes}
        initialNotes={notes.map(serializeNote)}
        feedMode={feedMode}
        searchQuery={searchQuery}
        searchError={searchError}
        currentPage={currentPage}
        pageSize={HOME_TIMELINE_PAGE_SIZE}
        isAdmin={admin}
      />
    </>
  )
}
