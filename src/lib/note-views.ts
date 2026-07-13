export type NoteViewSource = "direct" | "home" | "notes"

export const NOTE_VIEW_TTL_MS = 24 * 60 * 60 * 1000

export function isNoteViewSource(value: unknown): value is NoteViewSource {
  return value === "direct" || value === "home" || value === "notes"
}
