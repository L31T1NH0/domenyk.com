import { ObjectId } from "mongodb"
import { asSlug, asString, asStringArray, toObjectId } from "@/lib/validation"

export type SeriesInput = {
  title: string
  slug: string
  description: string
  published: boolean
  postIds: ObjectId[]
}

export function seriesInputFromBody(body: Record<string, unknown> | null): SeriesInput {
  const title = asString(body?.title, 140)
  const slug = asSlug(body?.slug, 100)
  const description = asString(body?.description, 1200)
  if (!title) throw new Error("Título é obrigatório e deve ter até 140 caracteres.")
  if (!slug) throw new Error("Slug inválido. Use apenas letras minúsculas, números e hífens.")
  if (!description) throw new Error("Apresentação é obrigatória e deve ter até 1.200 caracteres.")

  const rawPostIds = asStringArray(body?.postIds, 200, 24)
  const uniquePostIds = [...new Set(rawPostIds)]
  const postIds = uniquePostIds.map(toObjectId)
  if (postIds.some((id) => !id)) throw new Error("A seleção contém um post inválido.")

  return {
    title,
    slug,
    description,
    published: body?.published === true,
    postIds: postIds as ObjectId[],
  }
}
