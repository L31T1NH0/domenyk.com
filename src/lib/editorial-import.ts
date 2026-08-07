import { createHash } from "node:crypto"
import { getDb } from "./db/client"
import {
  deleteNote,
  markNoteDeleting,
  normalizeNoteContent,
  type Note,
  updateNote,
} from "./db/notes"
import {
  deleteCommentImagesFromContents,
  queueCommentImagesForCleanup,
} from "./db/comment-uploads"
import { deleteCommentsForParent, getCommentsForParent } from "./db/comments"

export type EditorialImportPart = {
  sourceNoteId: string
  sourceRootId: string
  position: number
  originalContent: string
  originalFingerprint: string
  proposedContent: string
  proposedFingerprint: string
  changed: boolean
}

export type EditorialImportAction = {
  editorialId: string
  title: string
  decision: "keep" | "revise" | "archive"
  action: "keep" | "update" | "archive"
  parts: EditorialImportPart[]
}

export type EditorialImportBundle = {
  version: 1
  kind: "domenyk_editorial_import"
  generatedAt: string
  sourceRequest: string
  source: string
  safety: {
    match: "sha256(normalize(content))"
    applyRequiresUniqueMatch: true
    archiveDeletesMatchedNotes: true
  }
  counts?: { units: number; archive: number; update: number; keep: number }
  actions: EditorialImportAction[]
}

type MatchStatus = "matched" | "unchanged" | "missing" | "ambiguous" | "duplicate"

type PlanItem = {
  editorialId: string
  title: string
  action: EditorialImportAction["action"]
  position: number
  sourceNoteId: string
  status: MatchStatus
  noteId?: string
  detail?: string
  changed?: boolean
}

export type EditorialImportPreview = {
  ok: boolean
  canApply: boolean
  counts: {
    units: number
    archive: number
    update: number
    unchanged: number
    missing: number
    ambiguous: number
    duplicate: number
  }
  items: PlanItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, maxLength = 100_000) {
  return typeof value === "string" && value.length <= maxLength ? value : null
}

export function normalizeEditorialImportContent(content: string) {
  return String(content || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n")
    .trim()
}

export function editorialImportFingerprint(content: string) {
  return createHash("sha256")
    .update(normalizeEditorialImportContent(content))
    .digest("hex")
}

function parsePart(value: unknown): EditorialImportPart | null {
  if (!isRecord(value)) return null
  const sourceNoteId = stringValue(value.sourceNoteId, 100)
  const sourceRootId = stringValue(value.sourceRootId, 100)
  const originalContent = stringValue(value.originalContent)
  const originalFingerprint = stringValue(value.originalFingerprint, 100)
  const proposedContent = stringValue(value.proposedContent)
  const proposedFingerprint = stringValue(value.proposedFingerprint, 100)
  if (!sourceNoteId || !sourceRootId || originalContent === null || !originalFingerprint || proposedContent === null || !proposedFingerprint) return null
  if (typeof value.position !== "number" || !Number.isInteger(value.position) || value.position < 1) return null
  if (typeof value.changed !== "boolean") return null
  return {
    sourceNoteId,
    sourceRootId,
    position: value.position,
    originalContent,
    originalFingerprint,
    proposedContent,
    proposedFingerprint,
    changed: value.changed,
  }
}

export function validateEditorialImportBundle(value: unknown): EditorialImportBundle {
  if (!isRecord(value) || value.version !== 1 || value.kind !== "domenyk_editorial_import") {
    throw new Error("Pacote editorial inválido.")
  }
  if (value.safety && isRecord(value.safety) && value.safety.match !== "sha256(normalize(content))") {
    throw new Error("O pacote usa um método de correspondência incompatível.")
  }
  if (!Array.isArray(value.actions) || value.actions.length > 500) throw new Error("O pacote não contém uma lista de ações válida.")
  const actions: EditorialImportAction[] = []
  const actionIds = new Set<string>()
  for (const rawAction of value.actions) {
    if (!isRecord(rawAction)) throw new Error("Uma ação do pacote é inválida.")
    const editorialId = stringValue(rawAction.editorialId, 100)
    const title = stringValue(rawAction.title, 500)
    const decision = rawAction.decision
    const action = rawAction.action
    if (!editorialId || title === null || !["keep", "revise", "archive"].includes(String(decision)) || !["keep", "update", "archive"].includes(String(action))) {
      throw new Error("Uma ação do pacote contém campos inválidos.")
    }
    if (actionIds.has(editorialId)) throw new Error(`A unidade ${editorialId} aparece mais de uma vez.`)
    actionIds.add(editorialId)
    if (!Array.isArray(rawAction.parts) || rawAction.parts.length > 100) throw new Error(`A unidade ${editorialId} não contém partes válidas.`)
    const parts = rawAction.parts.map(parsePart)
    if (parts.some((part): part is null => part === null)) throw new Error(`A unidade ${editorialId} contém uma parte inválida.`)
    actions.push({
      editorialId,
      title,
      decision: decision as EditorialImportAction["decision"],
      action: action as EditorialImportAction["action"],
      parts: parts as EditorialImportPart[],
    })
  }
  return {
    version: 1,
    kind: "domenyk_editorial_import",
    generatedAt: stringValue(value.generatedAt, 100) ?? "",
    sourceRequest: stringValue(value.sourceRequest, 500) ?? "",
    source: stringValue(value.source, 500) ?? "",
    safety: {
      match: "sha256(normalize(content))",
      applyRequiresUniqueMatch: true,
      archiveDeletesMatchedNotes: true,
    },
    counts: isRecord(value.counts) ? {
      units: Number(value.counts.units) || 0,
      archive: Number(value.counts.archive) || 0,
      update: Number(value.counts.update) || 0,
      keep: Number(value.counts.keep) || 0,
    } : undefined,
    actions,
  }
}

async function getNoteCandidates(bundle: EditorialImportBundle) {
  const fingerprints = new Set(bundle.actions.flatMap((action) => action.parts.map((part) => part.originalFingerprint)))
  const notes = await (await getDb()).collection<Note>("notes").find({ deleting: { $ne: true } }).toArray()
  const byFingerprint = new Map<string, Note[]>()
  for (const note of notes) {
    const fingerprint = editorialImportFingerprint(normalizeNoteContent(note.content))
    if (!fingerprints.has(fingerprint)) continue
    const candidates = byFingerprint.get(fingerprint) ?? []
    candidates.push(note)
    byFingerprint.set(fingerprint, candidates)
  }
  return byFingerprint
}

async function buildPlan(bundle: EditorialImportBundle) {
  const byFingerprint = await getNoteCandidates(bundle)
  const claimed = new Set<string>()
  const items: PlanItem[] = []
  const operations: Array<{ action: EditorialImportAction; part: EditorialImportPart; note: Note }> = []
  for (const action of bundle.actions) {
    for (const part of action.parts) {
      if (action.action === "keep" || (action.action === "update" && !part.changed)) continue
      const candidates = byFingerprint.get(part.originalFingerprint) ?? []
      if (candidates.length === 0) {
        items.push({ editorialId: action.editorialId, title: action.title, action: action.action, position: part.position, sourceNoteId: part.sourceNoteId, status: "missing", detail: "Nenhuma nota do site possui esta impressão digital." })
        continue
      }
      if (candidates.length > 1) {
        items.push({ editorialId: action.editorialId, title: action.title, action: action.action, position: part.position, sourceNoteId: part.sourceNoteId, status: "ambiguous", detail: `${candidates.length} notas possuem o mesmo conteúdo.` })
        continue
      }
      const note = candidates[0]
      const noteId = note._id.toString()
      if (claimed.has(noteId)) {
        items.push({ editorialId: action.editorialId, title: action.title, action: action.action, position: part.position, sourceNoteId: part.sourceNoteId, status: "duplicate", noteId, detail: "A mesma nota foi apontada por mais de uma ação." })
        continue
      }
      claimed.add(noteId)
      const unchanged = action.action === "update" && editorialImportFingerprint(part.proposedContent) === part.originalFingerprint
      items.push({ editorialId: action.editorialId, title: action.title, action: action.action, position: part.position, sourceNoteId: part.sourceNoteId, status: unchanged ? "unchanged" : "matched", noteId, changed: !unchanged })
      operations.push({ action, part, note })
    }
  }
  return { items, operations }
}

export async function previewEditorialImport(bundle: EditorialImportBundle): Promise<EditorialImportPreview> {
  const { items } = await buildPlan(bundle)
  const counts = {
    units: bundle.actions.length,
    archive: items.filter((item) => item.action === "archive" && item.status === "matched").length,
    update: items.filter((item) => item.action === "update" && item.status === "matched").length,
    unchanged: items.filter((item) => item.status === "unchanged").length,
    missing: items.filter((item) => item.status === "missing").length,
    ambiguous: items.filter((item) => item.status === "ambiguous").length,
    duplicate: items.filter((item) => item.status === "duplicate").length,
  }
  return { ok: true, canApply: counts.missing === 0 && counts.ambiguous === 0 && counts.duplicate === 0, counts, items }
}

async function removeNoteAndChildren(noteId: string) {
  const marked = await markNoteDeleting(noteId)
  if (!marked) throw new Error("Uma nota do pacote não existe mais.")
  const comments = await getCommentsForParent(noteId)
  const contents = comments.map((comment) => comment.content)
  await queueCommentImagesForCleanup(contents)
  await deleteCommentsForParent(noteId)
  const result = await deleteNote(noteId)
  await deleteCommentImagesFromContents(contents)
  if (!result.deleted) throw new Error("Uma nota do pacote não pôde ser excluída.")
}

export async function applyEditorialImport(bundle: EditorialImportBundle) {
  const plan = await buildPlan(bundle)
  const blocked = plan.items.filter((item) => ["missing", "ambiguous", "duplicate"].includes(item.status))
  if (blocked.length) {
    const error = new Error("A importação foi bloqueada porque existem correspondências inseguras.")
    Object.assign(error, { code: "EDITORIAL_IMPORT_CONFLICT", blocked })
    throw error
  }
  const changedNoteIds: string[] = []
  for (const { action, part, note } of plan.operations) {
    const noteId = note._id.toString()
    if (action.action === "archive") {
      await removeNoteAndChildren(noteId)
      changedNoteIds.push(noteId)
      continue
    }
    const updated = await updateNote(noteId, { content: part.proposedContent })
    if (!updated) throw new Error("Uma nota do pacote não pôde ser atualizada.")
    changedNoteIds.push(noteId)
  }
  return { changedNoteIds }
}
