import "server-only"

import type { Document, ObjectId } from "mongodb"
import { getDb } from "./client"
import type { Note } from "./notes"
import { ensurePostPublicIds, type PostSummary } from "./posts"

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
