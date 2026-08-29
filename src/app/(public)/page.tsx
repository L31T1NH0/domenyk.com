import type { Metadata } from "next"
import { headers } from "next/headers"
import { isAdmin } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentityFromHeaders } from "@/lib/request-identity"
import { HomeTimeline } from "./HomeTimeline"
import { buildPageMetadata } from "@/lib/seo"
import {
  getHomeTimelinePage,
  getCachedPublicContentCounts,
  getCachedPublicSearchContentCounts,
} from "@/lib/public-content-cache"

const HOME_TIMELINE_PAGE_SIZE = 10
const FEED_MODES = ["all", "posts", "notes"] as const
type FeedMode = (typeof FEED_MODES)[number]

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
  searchParams: Promise<{ mode?: string | string[]; q?: string | string[] }>
}): Promise<Metadata> {
  const params = await searchParams
  const mode = parseFeedMode(params.mode)
  const query = parseSearchQuery(params.q)
  const isFiltered = Boolean(query) || mode !== "all"
  const pageMetadata = buildPageMetadata({ path: "/" })

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
  searchParams: Promise<{ mode?: string | string[]; q?: string | string[] }>
}) {
  const params = await searchParams
  const feedMode = parseFeedMode(params.mode)
  const searchQuery = parseSearchQuery(params.q)
  const searchAllowed = !searchQuery || await rateLimit(
    `home-search:${requestIdentityFromHeaders(await headers())}`,
    { limit: 30, windowMs: 60_000 }
  )
  const effectiveSearch = searchAllowed ? searchQuery : ""
  const searchError = searchAllowed ? "" : "Muitas buscas. Aguarde um instante e tente novamente."

  const adminPromise = isAdmin()
  const countsPromise = effectiveSearch
    ? getCachedPublicSearchContentCounts(effectiveSearch)
    : getCachedPublicContentCounts()
  const [counts, initialPage, admin] = await Promise.all([
    countsPromise,
    getHomeTimelinePage({
      page: 1,
      mode: feedMode,
      limit: HOME_TIMELINE_PAGE_SIZE,
      search: effectiveSearch || undefined,
    }),
    adminPromise,
  ])
  const { totalPosts, totalNotes } = counts
  return (
    <>
      <h1 className="sr-only">Domenyk</h1>
      <HomeTimeline
        key={`${feedMode}:${searchQuery}`}
        posts={initialPage.posts}
        totalPosts={totalPosts}
        totalNotes={totalNotes}
        initialNotes={initialPage.notes}
        desktopPosts={initialPage.desktopPosts}
        desktopNotes={initialPage.desktopNotes}
        desktopThreadNotes={initialPage.desktopThreadNotes}
        desktopPostCount={initialPage.desktopPostCount}
        desktopLooseNoteCount={initialPage.desktopLooseNoteCount}
        desktopThreadCount={initialPage.desktopThreadCount}
        feedMode={feedMode}
        searchQuery={searchQuery}
        searchError={searchError}
        pageSize={HOME_TIMELINE_PAGE_SIZE}
        isAdmin={admin}
      />
    </>
  )
}
