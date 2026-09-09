import "server-only"

import { ObjectId, type Document } from "mongodb"
import { getDb } from "./client"
import { renderMarkdownSync } from "../mdx"
import type { PersonalUpdate, PersonalTimelinePage, PersonalUpdateOrderDirection } from "../personal-timeline"

type PersonalUpdateDocument = {
  _id: ObjectId
  content: string
  sortOrder?: number
  createdAt: Date
  updatedAt: Date
}

type OrderedPersonalUpdateDocument = PersonalUpdateDocument & {
  effectiveSortOrder: number
}

async function collection() {
  return (await getDb()).collection<PersonalUpdateDocument>("personal_updates")
}

function serialize(item: PersonalUpdateDocument): PersonalUpdate {
  return {
    _id: item._id.toHexString(),
    content: item.content,
    contentHtml: renderMarkdownSync(item.content),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export async function getPersonalUpdates(cursor?: string): Promise<PersonalTimelinePage> {
  const updates = await collection()
  const pipeline: Document[] = [
    { $set: { effectiveSortOrder: { $ifNull: ["$sortOrder", { $toLong: "$createdAt" }] } } },
  ]
  if (cursor) {
    const cursorId = new ObjectId(cursor)
    const cursorItem = await updates.findOne({ _id: cursorId })
    if (!cursorItem) return { items: [], nextCursor: null }
    const cursorOrder = cursorItem.sortOrder ?? cursorItem.createdAt.getTime()
    pipeline.push({
      $match: {
        $or: [
          { effectiveSortOrder: { $lt: cursorOrder } },
          { effectiveSortOrder: cursorOrder, _id: { $lt: cursorId } },
        ],
      },
    })
  }
  pipeline.push(
    { $sort: { effectiveSortOrder: -1, _id: -1 } },
    { $limit: 21 },
  )
  const items = await updates.aggregate<OrderedPersonalUpdateDocument>(pipeline).toArray()
  return {
    items: items.slice(0, 20).map(serialize),
    nextCursor: items.length > 20 ? items[19]._id.toHexString() : null,
  }
}

export async function createPersonalUpdate(content: string) {
  const now = new Date()
  const item = { _id: new ObjectId(), content, sortOrder: now.getTime(), createdAt: now, updatedAt: now }
  await (await collection()).insertOne(item)
  return serialize(item)
}

export async function movePersonalUpdate(id: string, direction: PersonalUpdateOrderDirection) {
  const updates = await collection()
  const ordered = await updates.aggregate<OrderedPersonalUpdateDocument>([
    { $set: { effectiveSortOrder: { $ifNull: ["$sortOrder", { $toLong: "$createdAt" }] } } },
    { $sort: { effectiveSortOrder: -1, _id: -1 } },
  ]).toArray()
  const currentIndex = ordered.findIndex(item => item._id.equals(id))
  if (currentIndex < 0) return "not-found" as const
  const targetIndex = currentIndex + (direction === "up" ? -1 : 1)
  if (targetIndex < 0 || targetIndex >= ordered.length) return "unchanged" as const

  const target = ordered[targetIndex]
  const uniqueOrders = new Set(ordered.map(item => item.effectiveSortOrder))
  const needsNormalization = uniqueOrders.size !== ordered.length || ordered.some(item => !Number.isFinite(item.sortOrder))
  if (needsNormalization) {
    const [current] = ordered.splice(currentIndex, 1)
    ordered.splice(targetIndex, 0, current)
    await updates.bulkWrite(ordered.map((item, index) => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { sortOrder: ordered.length - index } },
      },
    })))
  } else {
    await updates.bulkWrite([
      { updateOne: { filter: { _id: ordered[currentIndex]._id }, update: { $set: { sortOrder: target.effectiveSortOrder } } } },
      { updateOne: { filter: { _id: target._id }, update: { $set: { sortOrder: ordered[currentIndex].effectiveSortOrder } } } },
    ])
  }
  return "moved" as const
}

export async function editPersonalUpdate(id: string, content: string) {
  const item = await (await collection()).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { content, updatedAt: new Date() } },
    { returnDocument: "after" },
  )
  return item ? serialize(item) : null
}

export async function deletePersonalUpdate(id: string) {
  return (await (await collection()).deleteOne({ _id: new ObjectId(id) })).deletedCount > 0
}
