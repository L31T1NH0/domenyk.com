import { ObjectId } from "mongodb"
import { asSlug, asString, asStringArray, toObjectId } from "@/lib/validation"

export type ThemeInput = {
  name: string
  slug: string
  description: string
  active: boolean
  postIds: ObjectId[]
}

export function themeInputFromBody(body: Record<string, unknown> | null): ThemeInput {
  const name = asString(body?.name, 80)
  const slug = asSlug(body?.slug, 100)
  const description = asString(body?.description, 500)
  if (!name) throw new Error("Nome é obrigatório e deve ter até 80 caracteres.")
  if (!slug) throw new Error("Slug inválido. Use apenas letras minúsculas, números e hífens.")
  if (!description) throw new Error("Descrição é obrigatória e deve ter até 500 caracteres.")

  const postIds = asStringArray(body?.postIds, 200, 24).map(toObjectId)
  if (postIds.some((id) => !id)) throw new Error("A seleção contém um post inválido.")

  return {
    name,
    slug,
    description,
    active: body?.active === true,
    postIds: postIds as ObjectId[],
  }
}
