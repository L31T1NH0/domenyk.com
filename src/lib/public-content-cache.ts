import "server-only"

import { revalidateTag, unstable_cache } from "next/cache"
import { countNotes, getNotes, serializeNote, type SerializedNote } from "@/lib/db/notes"
import { countPosts, getPosts, serializePostSummary, type SerializedPostSummary } from "@/lib/db/posts"
import {
  countStandaloneNotes,
  getNoteThreadPage,
  getStandaloneTimelinePage,
  getTimelinePage,
} from "@/lib/db/timeline"

export const PUBLIC_CONTENT_CACHE_TAG = "public-content"
const PUBLIC_CONTENT_REVALIDATE_SECONDS = 60
const PUBLIC_SEARCH_REVALIDATE_SECONDS = 30

export type PublicFeedMode = "all" | "posts" | "notes"

export type CachedHomeFeed = {
  posts: SerializedPostSummary[]
  notes: SerializedNote[]
}

export type CachedDesktopHomeFeed = CachedHomeFeed & {
  threadNotes: SerializedNote[]
  postCount: number
  looseNoteCount: number
  threadCount: number
}

export type HomeTimelinePage = CachedHomeFeed & {
  desktopPosts: SerializedPostSummary[]
  desktopNotes: SerializedNote[]
  desktopThreadNotes: SerializedNote[]
  desktopPostCount: number
  desktopLooseNoteCount: number
  desktopThreadCount: number
}

export const getCachedPublicContentCounts = unstable_cache(
  async () => {
    const [totalPosts, totalNotes] = await Promise.all([
      countPosts({ excludeHiddenFromTimeline: true }),
      countNotes(),
    ])
    return { totalPosts, totalNotes }
  },
  ["public-content-counts"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS }
)

export const getCachedPublicSearchContentCounts = unstable_cache(
  async (search: string) => {
    const normalizedSearch = search.trim()
    const [totalPosts, totalNotes] = await Promise.all([
      countPosts({ excludeHiddenFromTimeline: true, search: normalizedSearch }),
      countNotes(normalizedSearch),
    ])
    return { totalPosts, totalNotes }
  },
  ["public-content-search-counts"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_SEARCH_REVALIDATE_SECONDS }
)

export const getCachedHomeFeed = unstable_cache(
  async (page: number, mode: PublicFeedMode, limit: number): Promise<CachedHomeFeed> => {
    if (mode === "all") {
      const entries = await getTimelinePage({ page, limit })
      return {
        posts: entries
          .filter((entry) => entry.type === "post")
          .map((entry) => serializePostSummary(entry.post)),
        notes: entries
          .filter((entry) => entry.type === "note")
          .map((entry) => serializeNote(entry.note)),
      }
    }

    if (mode === "posts") {
      const { posts } = await getPosts({
        page,
        limit,
        excludeHiddenFromTimeline: true,
      })
      return { posts: posts.map((post) => serializePostSummary(post)), notes: [] }
    }

    const { notes } = await getNotes({ page, limit })
    return { posts: [], notes: notes.map(serializeNote) }
  },
  ["home-feed"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS }
)

export const getCachedDesktopHomeFeed = unstable_cache(
  async (page: number, mode: PublicFeedMode, limit: number): Promise<CachedDesktopHomeFeed> => {
    const [entries, postCount, looseNoteCount, threadPage] = await Promise.all([
      getStandaloneTimelinePage({ page, limit, mode }),
      mode === "notes" ? Promise.resolve(0) : countPosts({ excludeHiddenFromTimeline: true }),
      mode === "posts" ? Promise.resolve(0) : countStandaloneNotes(),
      mode === "posts" ? Promise.resolve({ threads: [], total: 0 }) : getNoteThreadPage({ page, limit }),
    ])

    return {
      posts: entries
        .filter((entry) => entry.type === "post")
        .map((entry) => serializePostSummary(entry.post)),
      notes: entries
        .filter((entry) => entry.type === "note")
        .map((entry) => serializeNote(entry.note)),
      threadNotes: threadPage.threads.flat().map(serializeNote),
      postCount,
      looseNoteCount,
      threadCount: threadPage.total,
    }
  },
  ["home-feed-desktop"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS }
)

async function getHomeSearchTimelinePage(
  page: number,
  mode: PublicFeedMode,
  limit: number,
  normalizedSearch: string
): Promise<HomeTimelinePage> {
  let posts: SerializedPostSummary[] = []
  let notes: SerializedNote[] = []

  if (mode === "all") {
    const entries = await getTimelinePage({ page, limit, search: normalizedSearch })
    posts = entries
      .filter((entry) => entry.type === "post")
      .map((entry) => serializePostSummary(entry.post))
    notes = entries
      .filter((entry) => entry.type === "note")
      .map((entry) => serializeNote(entry.note))
  } else if (mode === "posts") {
    const result = await getPosts({
      page,
      limit,
      excludeHiddenFromTimeline: true,
      search: normalizedSearch,
    })
    posts = result.posts.map((post) => serializePostSummary(post))
  } else {
    const result = await getNotes({ page, limit, search: normalizedSearch })
    notes = result.notes.map(serializeNote)
  }

  const [desktopEntries, desktopPostCount, desktopLooseNoteCount, threadPage] = await Promise.all([
    getStandaloneTimelinePage({ page, limit, search: normalizedSearch, mode }),
    mode === "notes"
      ? Promise.resolve(0)
      : countPosts({ excludeHiddenFromTimeline: true, search: normalizedSearch }),
    mode === "posts" ? Promise.resolve(0) : countStandaloneNotes(normalizedSearch),
    mode === "posts"
      ? Promise.resolve({ threads: [], total: 0 })
      : getNoteThreadPage({ page, limit, search: normalizedSearch }),
  ])

  return {
    posts,
    notes,
    desktopPosts: desktopEntries
      .filter((entry) => entry.type === "post")
      .map((entry) => serializePostSummary(entry.post)),
    desktopNotes: desktopEntries
      .filter((entry) => entry.type === "note")
      .map((entry) => serializeNote(entry.note)),
    desktopThreadNotes: threadPage.threads.flat().map(serializeNote),
    desktopPostCount,
    desktopLooseNoteCount,
    desktopThreadCount: threadPage.total,
  }
}

const getCachedHomeSearchTimelinePage = unstable_cache(
  getHomeSearchTimelinePage,
  ["home-search-feed"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_SEARCH_REVALIDATE_SECONDS }
)

export async function getHomeTimelinePage({
  page,
  mode,
  limit,
  search,
}: {
  page: number
  mode: PublicFeedMode
  limit: number
  search?: string
}): Promise<HomeTimelinePage> {
  const normalizedSearch = search?.trim()

  if (!normalizedSearch) {
    const [feed, desktop] = await Promise.all([
      getCachedHomeFeed(page, mode, limit),
      getCachedDesktopHomeFeed(page, mode, limit),
    ])

    return {
      ...feed,
      desktopPosts: desktop.posts,
      desktopNotes: desktop.notes,
      desktopThreadNotes: desktop.threadNotes,
      desktopPostCount: desktop.postCount,
      desktopLooseNoteCount: desktop.looseNoteCount,
      desktopThreadCount: desktop.threadCount,
    }
  }

  return getCachedHomeSearchTimelinePage(page, mode, limit, normalizedSearch)
}

export const getCachedPublicPosts = unstable_cache(
  async (page: number, limit: number) => {
    const { posts, total } = await getPosts({
      page,
      limit,
      excludeHiddenFromTimeline: true,
    })
    return { posts: posts.map((post) => serializePostSummary(post)), total }
  },
  ["public-post-list"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS }
)

export const getCachedInitialNotes = unstable_cache(
  async (limit: number) => {
    const { notes, nextCursor, total } = await getNotes({ limit })
    return { notes: notes.map(serializeNote), nextCursor, total }
  },
  ["public-note-list-initial"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS }
)

export function invalidatePublicContentCache() {
  revalidateTag(PUBLIC_CONTENT_CACHE_TAG, { expire: 0 })
}
