import "server-only"

import { ObjectId } from "mongodb"
import { getDb } from "./client"
import { getPublishedPostsByIds, type PostSummary } from "./posts"
import { toObjectId } from "../validation"

export type Theme = {
  _id: ObjectId
  name: string
  slug: string
  description: string
  active: boolean
  postIds: ObjectId[]
  createdAt: Date
  updatedAt: Date
}

export type SerializedTheme = Omit<Theme, "_id" | "postIds" | "createdAt" | "updatedAt"> & {
  _id: string
  postIds: string[]
  postCount: number
  createdAt: string
  updatedAt: string
}

const DEFAULT_THEMES = [
  { name: "Liberalismo", slug: "liberalismo", description: "Textos sobre liberdade individual, mercados e limites do poder político." },
  { name: "Liberdade de expressão", slug: "liberdade-de-expressao", description: "Textos sobre censura, debate público e o direito de discordar." },
  { name: "Propriedade e regulação", slug: "propriedade-e-regulacao", description: "Textos sobre propriedade privada, regras econômicas e intervenção estatal." },
  { name: "Estado e direito", slug: "estado-e-direito", description: "Textos sobre instituições, leis, justiça e os limites do Estado." },
  { name: "Mérito e responsabilidade", slug: "merito-e-responsabilidade", description: "Textos sobre escolhas, incentivos, mérito e responsabilidade individual." },
  { name: "Crime e proibição", slug: "crime-e-proibicao", description: "Textos sobre criminalidade, proibições e consequências de políticas públicas." },
] as const

let indexesPromise: Promise<void> | undefined

async function collection() {
  const col = (await getDb()).collection<Theme>("themes")
  indexesPromise ??= Promise.all([
    col.createIndex({ slug: 1 }, { unique: true }),
    col.createIndex({ active: 1, updatedAt: -1 }),
  ]).then(() => undefined)
  await indexesPromise
  return col
}

export function serializeTheme(theme: Theme): SerializedTheme {
  return {
    _id: theme._id.toString(),
    name: theme.name,
    slug: theme.slug,
    description: theme.description,
    active: theme.active,
    postIds: theme.postIds.map((id) => id.toString()),
    postCount: theme.postIds.length,
    createdAt: theme.createdAt.toISOString(),
    updatedAt: theme.updatedAt.toISOString(),
  }
}

export async function ensureDefaultThemes(): Promise<void> {
  const col = await collection()
  const now = new Date()
  await Promise.all(DEFAULT_THEMES.map((theme) => col.updateOne(
    { slug: theme.slug },
    { $setOnInsert: { ...theme, active: false, postIds: [], createdAt: now, updatedAt: now } },
    { upsert: true }
  )))
}

export async function getThemes({ activeOnly = false }: { activeOnly?: boolean } = {}): Promise<Theme[]> {
  return (await collection())
    .find(activeOnly ? { active: true } : {})
    .sort({ name: 1 })
    .toArray()
}

export async function getThemeById(id: string): Promise<Theme | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return (await collection()).findOne({ _id: objectId })
}

export async function getThemeBySlug(slug: string, { activeOnly = false }: { activeOnly?: boolean } = {}): Promise<Theme | null> {
  return (await collection()).findOne(activeOnly ? { slug, active: true } : { slug })
}

export async function getThemePosts(theme: Pick<Theme, "postIds">): Promise<PostSummary[]> {
  return getPublishedPostsByIds(theme.postIds)
}

export async function getThemesForPost(
  postId: ObjectId,
  { activeOnly = false }: { activeOnly?: boolean } = {}
): Promise<Theme[]> {
  return (await collection())
    .find(activeOnly ? { postIds: postId, active: true } : { postIds: postId })
    .sort({ name: 1 })
    .toArray()
}

export async function setThemesForPost(postId: ObjectId, themeIds: ObjectId[]): Promise<void> {
  const selectedIds = new Set(themeIds.map((id) => id.toString()))
  const themes = await (await collection()).find({}, { projection: { _id: 1 } }).toArray()
  const knownIds = new Set(themes.map((theme) => theme._id.toString()))
  if ([...selectedIds].some((id) => !knownIds.has(id))) throw new Error("Tema inválido.")
  if (themes.length === 0) return

  await (await collection()).bulkWrite(themes.map((theme) => ({
    updateOne: {
      filter: { _id: theme._id },
      update: selectedIds.has(theme._id.toString())
        ? { $addToSet: { postIds: postId }, $set: { updatedAt: new Date() } }
        : { $pull: { postIds: postId }, $set: { updatedAt: new Date() } },
    },
  })))
}

export async function getActiveThemeUpdates(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return (await collection())
    .find({ active: true }, { projection: { slug: 1, updatedAt: 1 } })
    .sort({ slug: 1 })
    .toArray()
}

export async function createTheme(data: Omit<Theme, "_id" | "createdAt" | "updatedAt">): Promise<Theme> {
  const now = new Date()
  const theme: Omit<Theme, "_id"> = { ...data, createdAt: now, updatedAt: now }
  const result = await (await collection()).insertOne(theme as Theme)
  return { ...theme, _id: result.insertedId }
}

export async function updateTheme(id: string, data: Pick<Theme, "name" | "slug" | "description" | "active" | "postIds">): Promise<Theme | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return (await collection()).findOneAndUpdate(
    { _id: objectId },
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: "after" }
  )
}

export async function deleteTheme(id: string): Promise<boolean> {
  const objectId = toObjectId(id)
  if (!objectId) return false
  return (await collection()).deleteOne({ _id: objectId }).then((result) => result.deletedCount === 1)
}
