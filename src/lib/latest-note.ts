export type LatestNote = {
  id: string
  publishedAt: string
  content: string
}

export async function fetchLatestNote(signal?: AbortSignal): Promise<LatestNote | null> {
  const response = await fetch("/api/links/latest-note", {
    headers: { Accept: "application/json" },
    signal,
  })
  if (!response.ok) throw new Error("Não foi possível carregar a última nota.")

  const data: unknown = await response.json()
  if (!data || typeof data !== "object" || !("notes" in data) || !Array.isArray(data.notes)) {
    throw new Error("Resposta de notas inválida.")
  }
  if (!data.notes.length) return null

  const note = data.notes[0]
  if (!note || typeof note !== "object" ||
      typeof note._id !== "string" || !/^[a-f\d]{24}$/i.test(note._id) ||
      typeof note.content !== "string" ||
      typeof note.publishedAt !== "string" || !Number.isFinite(Date.parse(note.publishedAt))) {
    throw new Error("Nota inválida.")
  }

  return {
    id: note._id,
    publishedAt: note.publishedAt,
    content: note.content,
  }
}
