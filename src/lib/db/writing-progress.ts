import "server-only"

import { ObjectId } from "mongodb"
import { getDb } from "./client"

type WritingEntry = {
  _id: ObjectId
  title: string
  progress: number
  completed: boolean
  createdAt: Date
  updatedAt: Date
}

export type WritingProgressItem = { id: string; title: string; progress: number }
export type AdminWritingEntry = WritingProgressItem & { completed: boolean }

async function collection() {
  return (await getDb()).collection<WritingEntry>("writing_progress")
}

export async function getWritingEntries(): Promise<AdminWritingEntry[]> {
  const entries = await (await collection()).find().sort({ completed: 1, createdAt: -1, _id: -1 }).toArray()
  return entries.map((entry) => ({
    id: entry._id.toString(), title: entry.title, progress: entry.progress, completed: entry.completed,
  }))
}

export async function getWritingProgress(): Promise<WritingProgressItem[]> {
  const entries = await (await collection()).find({ completed: false }, {
    projection: { _id: 1, title: 1, progress: 1 },
  }).sort({ createdAt: -1, _id: -1 }).toArray()
  return entries.map((entry) => ({ id: entry._id.toString(), title: entry.title, progress: entry.progress }))
}

export async function createWritingEntry(data: { title: string; progress: number }): Promise<AdminWritingEntry> {
  const now = new Date()
  const entry: WritingEntry = { ...data, _id: new ObjectId(), completed: false, createdAt: now, updatedAt: now }
  await (await collection()).insertOne(entry)
  return { id: entry._id.toString(), title: entry.title, progress: entry.progress, completed: false }
}

export async function updateWritingEntry(id: ObjectId, data: Partial<Pick<WritingEntry, "title" | "progress" | "completed">>) {
  const result = await (await collection()).updateOne({ _id: id }, { $set: { ...data, updatedAt: new Date() } })
  return result.matchedCount > 0
}
