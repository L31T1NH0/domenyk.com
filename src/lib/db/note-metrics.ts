import "server-only"

import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { toObjectId } from "../validation"
import type { NoteViewSource } from "../note-views"

export type NoteMetrics = {
  directViews: number
  homeImpressions: number
  notesImpressions: number
  updatedAt?: Date
}

type StoredNoteMetrics = NoteMetrics & { _id: ObjectId; noteId: ObjectId }
type NoteViewEvent = {
  _id: ObjectId
  noteId: ObjectId
  visitorKey: string
  source: NoteViewSource
  day: string
  createdAt: Date
}

const EMPTY_METRICS: NoteMetrics = { directViews: 0, homeImpressions: 0, notesImpressions: 0 }
let indexesPromise: Promise<void> | undefined

async function collections() {
  const db = await getDb()
  const metrics = db.collection<StoredNoteMetrics>("note_metrics")
  const events = db.collection<NoteViewEvent>("note_view_events")
  indexesPromise ??= Promise.all([
    metrics.createIndex({ noteId: 1 }, { unique: true }),
    events.createIndex({ noteId: 1, visitorKey: 1, source: 1, day: 1 }, { unique: true }),
    events.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }),
  ]).then(() => undefined)
  await indexesPromise
  return { metrics, events }
}

function counterForSource(source: NoteViewSource): keyof Pick<NoteMetrics, "directViews" | "homeImpressions" | "notesImpressions"> {
  if (source === "direct") return "directViews"
  if (source === "home") return "homeImpressions"
  return "notesImpressions"
}

export async function recordNoteView(
  noteId: string,
  visitorKey: string,
  source: NoteViewSource
): Promise<{ counted: boolean; metrics: NoteMetrics }> {
  const objectId = toObjectId(noteId)
  if (!objectId) return { counted: false, metrics: EMPTY_METRICS }
  const { metrics, events } = await collections()
  const now = new Date()
  const day = now.toISOString().slice(0, 10)

  try {
    await events.insertOne({ _id: new ObjectId(), noteId: objectId, visitorKey, source, day, createdAt: now })
  } catch (error) {
    if (!(typeof error === "object" && error && "code" in error && error.code === 11000)) throw error
    return { counted: false, metrics: await getNoteMetrics(noteId) }
  }

  const counter = counterForSource(source)
  const result = await metrics.findOneAndUpdate(
    { noteId: objectId },
    {
      $inc: { [counter]: 1 },
      $set: { updatedAt: now },
      $setOnInsert: {
        _id: new ObjectId(),
        noteId: objectId,
        ...(counter === "directViews" ? { homeImpressions: 0, notesImpressions: 0 } : {}),
        ...(counter === "homeImpressions" ? { directViews: 0, notesImpressions: 0 } : {}),
        ...(counter === "notesImpressions" ? { directViews: 0, homeImpressions: 0 } : {}),
      },
    },
    { upsert: true, returnDocument: "after" }
  )

  return {
    counted: true,
    metrics: {
      directViews: result?.directViews ?? 0,
      homeImpressions: result?.homeImpressions ?? 0,
      notesImpressions: result?.notesImpressions ?? 0,
      updatedAt: result?.updatedAt,
    },
  }
}

export async function getNoteMetrics(noteId: string): Promise<NoteMetrics> {
  const objectId = toObjectId(noteId)
  if (!objectId) return { ...EMPTY_METRICS }
  const row = await (await collections()).metrics.findOne({ noteId: objectId })
  return row ? {
    directViews: row.directViews ?? 0,
    homeImpressions: row.homeImpressions ?? 0,
    notesImpressions: row.notesImpressions ?? 0,
    updatedAt: row.updatedAt,
  } : { ...EMPTY_METRICS }
}

export async function getNoteMetricsMap(noteIds: ObjectId[]): Promise<Map<string, NoteMetrics>> {
  if (noteIds.length === 0) return new Map()
  const rows = await (await collections()).metrics.find({ noteId: { $in: noteIds } }).toArray()
  return new Map(rows.map((row) => [row.noteId.toString(), {
    directViews: row.directViews ?? 0,
    homeImpressions: row.homeImpressions ?? 0,
    notesImpressions: row.notesImpressions ?? 0,
    updatedAt: row.updatedAt,
  }]))
}

export async function deleteNoteMetrics(noteId: string): Promise<void> {
  const objectId = toObjectId(noteId)
  if (!objectId) return
  const { metrics, events } = await collections()
  await Promise.all([metrics.deleteOne({ noteId: objectId }), events.deleteMany({ noteId: objectId })])
}
