import "server-only"

import type { Document, ObjectId } from "mongodb"
import { getDb } from "./client"
import type { Note } from "./notes"
import { ensurePostPublicIds, type PostSummary } from "./posts"
import { SITE_TIME_ZONE, siteDateKeyToInstant } from "../datetime"
import { noteDisplayTitle } from "../seo"

type RawTimelineRecord = Document & {
  _id: ObjectId
  _feedType: "post" | "note"
  _feedDate: Date
  _feedPinned: boolean
}

export type TimelineEntry =
  | { type: "post"; post: PostSummary }
  | { type: "note"; note: Note }

export type NoteThreadPage = {
  threads: Note[][]
  total: number
}

export type TimelineArchiveMonth = {
  year: number
  month: number
  count: number
}

export type TimelineArchiveItem = {
  id: string
  type: "post" | "note"
  title: string
  href: string
  publishedAt: string
  cover?: { url: string; alt?: string }
}

type ArchiveFeedMode = "all" | "posts" | "notes"

type RawTimelineArchiveItem = Document & {
  _id: ObjectId
  _archiveType: "post" | "note"
  _archiveDate: Date
  _archivePinned: boolean
  title?: string
  content?: string
  slug?: string
  cover?: { url: string; alt?: string }
}

function archiveMonthBounds(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return {
    start: siteDateKeyToInstant(`${year}-${String(month).padStart(2, "0")}-01`),
    end: siteDateKeyToInstant(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`),
  }
}

export async function getTimelineArchiveMonths({
  search,
  mode = "all",
}: {
  search?: string
  mode?: ArchiveFeedMode
} = {}): Promise<TimelineArchiveMonth[]> {
  const normalizedSearch = search?.trim()
  const postFilter: Document = {
    published: true,
    hiddenFromTimeline: { $ne: true },
    deleting: { $ne: true },
    ...(mode === "notes" ? { _id: { $exists: false } } : {}),
    ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
  }
  const noteFilter: Document = {
    deleting: { $ne: true },
    ...(mode === "posts" ? { _id: { $exists: false } } : {}),
    ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
  }
  const db = await getDb()
  const records = await db.collection("posts").aggregate<TimelineArchiveMonth & { _id?: unknown }>([
    { $match: postFilter },
    { $project: { _archiveDate: { $ifNull: ["$publishedAt", "$createdAt"] } } },
    {
      $unionWith: {
        coll: "notes",
        pipeline: [
          { $match: noteFilter },
          { $project: { _archiveDate: { $ifNull: ["$publishedAt", "$createdAt"] } } },
        ],
      },
    },
    {
      $group: {
        _id: {
          year: { $year: { date: "$_archiveDate", timezone: SITE_TIME_ZONE } },
          month: { $month: { date: "$_archiveDate", timezone: SITE_TIME_ZONE } },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": -1, "_id.month": -1 } },
    {
      $project: {
        _id: 0,
        year: "$_id.year",
        month: "$_id.month",
        count: 1,
      },
    },
  ]).toArray()

  return records.map(({ year, month, count }) => ({ year, month, count }))
}

export async function getTimelineArchiveItems({
  year,
  month,
  offset = 0,
  limit = 10,
  search,
  mode = "all",
}: {
  year: number
  month: number
  offset?: number
  limit?: number
  search?: string
  mode?: ArchiveFeedMode
}): Promise<{ items: TimelineArchiveItem[]; hasMore: boolean }> {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) throw new RangeError("Ano inválido")
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError("Mês inválido")

  const boundedOffset = Math.max(0, Math.floor(offset))
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 20))
  const normalizedSearch = search?.trim()
  const { start, end } = archiveMonthBounds(year, month)
  const dateMatch = { _archiveDate: { $gte: start, $lt: end } }
  const postFilter: Document = {
    published: true,
    hiddenFromTimeline: { $ne: true },
    deleting: { $ne: true },
    ...(mode === "notes" ? { _id: { $exists: false } } : {}),
    ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
  }
  const noteFilter: Document = {
    deleting: { $ne: true },
    ...(mode === "posts" ? { _id: { $exists: false } } : {}),
    ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
  }
  const db = await getDb()
  const records = await db.collection("posts").aggregate<RawTimelineArchiveItem>([
    { $match: postFilter },
    {
      $set: {
        _archiveType: "post",
        _archiveDate: { $ifNull: ["$publishedAt", "$createdAt"] },
        _archivePinned: { $eq: ["$pinned", true] },
      },
    },
    { $match: dateMatch },
    { $project: { title: 1, slug: 1, cover: 1, _archiveType: 1, _archiveDate: 1, _archivePinned: 1 } },
    {
      $unionWith: {
        coll: "notes",
        pipeline: [
          { $match: noteFilter },
          {
            $set: {
              _archiveType: "note",
              _archiveDate: { $ifNull: ["$publishedAt", "$createdAt"] },
              _archivePinned: false,
            },
          },
          { $match: dateMatch },
          { $project: { title: 1, content: 1, _archiveType: 1, _archiveDate: 1, _archivePinned: 1 } },
        ],
      },
    },
    { $sort: { _archivePinned: -1, _archiveDate: -1, _id: -1 } },
    { $skip: boundedOffset },
    { $limit: boundedLimit + 1 },
  ]).toArray()
  const hasMore = records.length > boundedLimit
  if (hasMore) records.pop()

  return {
    items: records.map((record) => {
      const id = record._id.toString()
      const isPost = record._archiveType === "post"
      return {
        id,
        type: record._archiveType,
        title: isPost
          ? record.title?.trim() || "Post de Domenyk"
          : noteDisplayTitle({ title: record.title, content: record.content ?? "" }),
        href: isPost ? `/posts/${encodeURIComponent(record.slug ?? id)}` : `/notes/${id}`,
        publishedAt: record._archiveDate.toISOString(),
        ...(isPost && record.cover?.url ? { cover: record.cover } : {}),
      }
    }),
    hasMore,
  }
}

export async function getTimelineCategoryItems({
  slug,
  offset = 0,
  limit = 10,
  search,
  mode = "all",
}: {
  slug: string
  offset?: number
  limit?: number
  search?: string
  mode?: ArchiveFeedMode
}): Promise<{ items: TimelineArchiveItem[]; hasMore: boolean }> {
  if (mode === "notes") return { items: [], hasMore: false }

  const normalizedSlug = slug.trim()
  if (!normalizedSlug || normalizedSlug.length > 100) throw new RangeError("Categoria inválida")

  const boundedOffset = Math.max(0, Math.floor(offset))
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 20))
  const normalizedSearch = search?.trim()
  const db = await getDb()
  const theme = await db.collection<{ slug: string; active: boolean; postIds: ObjectId[] }>("themes").findOne(
    { slug: normalizedSlug, active: true },
    { projection: { postIds: 1 } }
  )
  if (!theme || theme.postIds.length === 0) return { items: [], hasMore: false }

  const records = await db.collection("posts").aggregate<RawTimelineArchiveItem>([
    {
      $match: {
        _id: { $in: theme.postIds },
        published: true,
        hiddenFromTimeline: { $ne: true },
        deleting: { $ne: true },
        ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
      },
    },
    {
      $set: {
        _archiveType: "post",
        _archiveDate: { $ifNull: ["$publishedAt", "$createdAt"] },
        _archivePinned: { $eq: ["$pinned", true] },
      },
    },
    { $sort: { _archivePinned: -1, _archiveDate: -1, _id: -1 } },
    { $skip: boundedOffset },
    { $limit: boundedLimit + 1 },
    { $project: { title: 1, slug: 1, cover: 1, _archiveType: 1, _archiveDate: 1, _archivePinned: 1 } },
  ]).toArray()
  const hasMore = records.length > boundedLimit
  if (hasMore) records.pop()

  return {
    items: records.map((record) => {
      const id = record._id.toString()
      return {
        id,
        type: "post",
        title: record.title?.trim() || "Post de Domenyk",
        href: `/posts/${encodeURIComponent(record.slug ?? id)}`,
        publishedAt: record._archiveDate.toISOString(),
        ...(record.cover?.url ? { cover: record.cover } : {}),
      }
    }),
    hasMore,
  }
}

export async function getTimelinePage({
  page,
  limit,
  search,
}: {
  page: number
  limit: number
  search?: string
}): Promise<TimelineEntry[]> {
  const normalizedSearch = search?.trim()
  const postFilter: Document = {
    published: true,
    hiddenFromTimeline: { $ne: true },
    deleting: { $ne: true },
    ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
  }
  const noteFilter: Document = {
    deleting: { $ne: true },
    ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
  }
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 100))
  const boundedPage = Math.max(1, Math.floor(page))
  const branchLimit = boundedPage * boundedLimit
  const db = await getDb()

  const records = await db.collection("posts").aggregate<RawTimelineRecord>([
    { $match: postFilter },
    { $project: { content: 0, coAuthorUserId: 0 } },
    {
      $set: {
        _feedType: "post",
        _feedDate: { $ifNull: ["$publishedAt", "$createdAt"] },
        _feedPinned: { $eq: ["$pinned", true] },
      },
    },
    { $sort: { _feedPinned: -1, _feedDate: -1, _id: -1 } },
    { $limit: branchLimit },
    {
      $unionWith: {
        coll: "notes",
        pipeline: [
          { $match: noteFilter },
          {
            $set: {
              _feedType: "note",
              _feedDate: { $ifNull: ["$publishedAt", "$createdAt"] },
              _feedPinned: false,
            },
          },
          { $sort: { _feedPinned: -1, _feedDate: -1, _id: -1 } },
          { $limit: branchLimit },
        ],
      },
    },
    { $sort: { _feedPinned: -1, _feedDate: -1, _id: -1 } },
    { $skip: (boundedPage - 1) * boundedLimit },
    { $limit: boundedLimit },
  ]).toArray()

  const entries = records.map((record) => {
    const { _feedType, _feedDate: _date, _feedPinned: _pinned, ...document } = record
    void _date
    void _pinned
    return _feedType === "post"
      ? { type: "post" as const, post: document as PostSummary }
      : { type: "note" as const, note: document as Note }
  })
  await ensurePostPublicIds(
    entries.filter((entry) => entry.type === "post").map((entry) => entry.post)
  )
  return entries
}

export async function getStandaloneTimelinePage({
  page,
  limit,
  search,
  mode = "all",
}: {
  page: number
  limit: number
  search?: string
  mode?: "all" | "posts" | "notes"
}): Promise<TimelineEntry[]> {
  const normalizedSearch = search?.trim()
  const postFilter: Document = {
    published: true,
    hiddenFromTimeline: { $ne: true },
    deleting: { $ne: true },
    ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
  }
  const noteFilter: Document = {
    deleting: { $ne: true },
    threadRootId: { $exists: false },
    ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
  }
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 100))
  const boundedPage = Math.max(1, Math.floor(page))
  const branchLimit = boundedPage * boundedLimit
  const db = await getDb()

  if (mode === "posts") {
    const posts = await db.collection("posts")
      .find(postFilter, { projection: { content: 0, coAuthorUserId: 0 } })
      .sort({ pinned: -1, publishedAt: -1, _id: -1 })
      .skip((boundedPage - 1) * boundedLimit)
      .limit(boundedLimit)
      .toArray() as unknown as PostSummary[]
    await ensurePostPublicIds(posts)
    return posts.map((post) => ({ type: "post", post }))
  }

  if (mode === "notes") {
    const notes = await db.collection<Note>("notes")
      .find(noteFilter)
      .sort({ publishedAt: -1, createdAt: -1, _id: -1 })
      .skip((boundedPage - 1) * boundedLimit)
      .limit(boundedLimit)
      .toArray()
    return notes.map((note) => ({ type: "note", note }))
  }

  const records = await db.collection("posts").aggregate<RawTimelineRecord>([
    { $match: postFilter },
    { $project: { content: 0, coAuthorUserId: 0 } },
    {
      $set: {
        _feedType: "post",
        _feedDate: { $ifNull: ["$publishedAt", "$createdAt"] },
        _feedPinned: { $eq: ["$pinned", true] },
      },
    },
    { $sort: { _feedPinned: -1, _feedDate: -1, _id: -1 } },
    { $limit: branchLimit },
    {
      $unionWith: {
        coll: "notes",
        pipeline: [
          { $match: noteFilter },
          {
            $set: {
              _feedType: "note",
              _feedDate: { $ifNull: ["$publishedAt", "$createdAt"] },
              _feedPinned: false,
            },
          },
          { $sort: { _feedPinned: -1, _feedDate: -1, _id: -1 } },
          { $limit: branchLimit },
        ],
      },
    },
    { $sort: { _feedPinned: -1, _feedDate: -1, _id: -1 } },
    { $skip: (boundedPage - 1) * boundedLimit },
    { $limit: boundedLimit },
  ]).toArray()

  const entries = records.map((record) => {
    const { _feedType, _feedDate: _date, _feedPinned: _pinned, ...document } = record
    void _date
    void _pinned
    return _feedType === "post"
      ? { type: "post" as const, post: document as PostSummary }
      : { type: "note" as const, note: document as Note }
  })
  await ensurePostPublicIds(
    entries.filter((entry) => entry.type === "post").map((entry) => entry.post)
  )
  return entries
}

export async function countStandaloneNotes(search?: string): Promise<number> {
  const normalizedSearch = search?.trim()
  const filter: Document = {
    deleting: { $ne: true },
    threadRootId: { $exists: false },
    ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
  }
  return (await getDb()).collection("notes").countDocuments(filter)
}

export async function getNoteThreadPage({
  page = 1,
  limit = 10,
  search,
}: {
  page?: number
  limit?: number
  search?: string
} = {}): Promise<NoteThreadPage> {
  const normalizedSearch = search?.trim()
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 50))
  const boundedPage = Math.max(1, Math.floor(page))
  const db = await getDb()
  const match: Document = {
    deleting: { $ne: true },
    threadRootId: { $exists: true },
    ...(normalizedSearch ? { $text: { $search: normalizedSearch } } : {}),
  }
  const [result] = await db.collection("notes").aggregate<{
    roots: Array<{ _id: ObjectId; latestAt: Date }>
    count: Array<{ total: number }>
  }>([
    { $match: match },
    {
      $group: {
        _id: "$threadRootId",
        latestAt: { $max: { $ifNull: ["$publishedAt", "$createdAt"] } },
      },
    },
    { $sort: { latestAt: -1, _id: -1 } },
    {
      $facet: {
        roots: [
          { $skip: (boundedPage - 1) * boundedLimit },
          { $limit: boundedLimit },
        ],
        count: [{ $count: "total" }],
      },
    },
  ]).toArray()

  const roots = result?.roots ?? []
  if (roots.length === 0) {
    return { threads: [], total: result?.count[0]?.total ?? 0 }
  }

  const notes = await db.collection<Note>("notes")
    .find({
      deleting: { $ne: true },
      threadRootId: { $in: roots.map((root) => root._id) },
    })
    .sort({ threadRootId: 1, threadPosition: 1, _id: 1 })
    .toArray()
  const notesByRoot = new Map<string, Note[]>()
  for (const note of notes) {
    const rootId = note.threadRootId?.toString()
    if (!rootId) continue
    const group = notesByRoot.get(rootId)
    if (group) group.push(note)
    else notesByRoot.set(rootId, [note])
  }

  return {
    threads: roots.flatMap((root) => {
      const thread = notesByRoot.get(root._id.toString())
      return thread && thread.length > 1 ? [thread] : []
    }),
    total: result?.count[0]?.total ?? 0,
  }
}
