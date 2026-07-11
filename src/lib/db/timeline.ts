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
