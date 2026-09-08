import "server-only"

import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { renderMarkdownSync } from "../mdx"
import type { PersonalUpdate, PersonalTimelinePage } from "../personal-timeline"

type PersonalUpdateDocument = {
  _id: ObjectId
  content: string
  createdAt: Date
  updatedAt: Date
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
  const items = await (await collection())
    .find(cursor ? { _id: { $lt: new ObjectId(cursor) } } : {})
    .sort({ _id: -1 }).limit(21).toArray()
  return {
    items: items.slice(0, 20).map(serialize),
    nextCursor: items.length > 20 ? items[19]._id.toHexString() : null,
  }
}

export async function createPersonalUpdate(content: string) {
  const now = new Date()
  const item = { _id: new ObjectId(), content, createdAt: now, updatedAt: now }
  await (await collection()).insertOne(item)
  return serialize(item)
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
