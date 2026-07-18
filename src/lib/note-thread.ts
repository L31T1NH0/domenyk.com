import type { ObjectId } from "mongodb"

export type NoteThreadFields = {
  threadRootId?: ObjectId
  previousNoteId?: ObjectId
  threadPosition?: number
}

export type SerializedNoteThread = {
  rootId: string
  previousId?: string
  position: number
}

export function serializeNoteThread(fields: NoteThreadFields): SerializedNoteThread | undefined {
  if (!fields.threadRootId || !fields.threadPosition) return undefined
  return {
    rootId: fields.threadRootId.toString(),
    ...(fields.previousNoteId ? { previousId: fields.previousNoteId.toString() } : {}),
    position: fields.threadPosition,
  }
}

export function groupNotesByThread<T extends { _id: string; thread?: SerializedNoteThread }>(notes: T[]): T[][] {
  const grouped = new Map<string, T[]>()
  const order: string[] = []

  for (const note of notes) {
    const key = note.thread?.rootId ?? note._id
    const existing = grouped.get(key)
    if (existing) {
      existing.push(note)
    } else {
      grouped.set(key, [note])
      order.push(key)
    }
  }

  return order.map((key) => {
    const group = grouped.get(key) ?? []
    return group.length > 1
      ? [...group].sort((a, b) => (a.thread?.position ?? 1) - (b.thread?.position ?? 1))
      : group
  })
}

export function mergeNotesById<T extends { _id: string }>(current: T[], updates: T[]): T[] {
  const updateMap = new Map(updates.map((note) => [note._id, note]))
  const currentIds = new Set(current.map((note) => note._id))
  return [
    ...current.map((note) => updateMap.get(note._id) ?? note),
    ...updates.filter((note) => !currentIds.has(note._id)),
  ]
}
