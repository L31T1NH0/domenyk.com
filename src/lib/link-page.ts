import { isSafeLinkURL } from "./links.ts"

export type ContentKind = "post" | "note" | "link"
export type ContentSelection = {
  kind: ContentKind
  id: string
  title: string
  description: string
  coverMode: "original" | "none" | "custom"
  cover: string
  coverAlt: string
}
export type LinkSection = { id: string; title: string; layout: "row" | "cards" }
export type LinkPageSettings = {
  heading: string
  intro: string
  metaTitle: string
  metaDescription: string
  featuredHeading: string
  readingsHeading: string
  includeLatest: boolean
  featured: ContentSelection[]
  readings: ContentSelection[]
  sections: LinkSection[]
}
export type LinkContent = { kind: ContentKind; id: string; title: string; description: string; url: string; cover: string; coverAlt: string; publishedAt: string }
export type LinkPageData = { settings: LinkPageSettings | null; featured: LinkContent[]; readings: LinkContent[] }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Configuração inválida.")
  return value as Record<string, unknown>
}
function text(value: unknown, limit: number): string {
  if (typeof value !== "string" || [...value.trim()].length > limit) throw new Error("Confira o tamanho e o conteúdo dos campos.")
  return value.trim()
}
function image(value: unknown): string {
  const url = text(value, 2048)
  if (url && !isSafeLinkURL(url)) throw new Error("Use uma imagem HTTPS ou um caminho do site.")
  return url
}
export function parseSelection(value: unknown): ContentSelection {
  const input = record(value)
  if (!["post", "note", "link"].includes(input.kind as string) || typeof input.id !== "string" || !/^[a-f\d]{24}$/i.test(input.id)) throw new Error("Selecione um conteúdo válido.")
  if (!["original", "none", "custom"].includes(input.coverMode as string)) throw new Error("Escolha uma opção de capa.")
  const cover = image(input.cover)
  if (input.coverMode === "custom" && !cover) throw new Error("Escolha a imagem da capa personalizada.")
  return { kind: input.kind as ContentKind, id: input.id, title: text(input.title, 180), description: text(input.description, 500), coverMode: input.coverMode as ContentSelection["coverMode"], cover, coverAlt: text(input.coverAlt, 180) }
}
export function parseLinkPageSettings(value: unknown): LinkPageSettings {
  const input = record(value)
  if (typeof input.includeLatest !== "boolean" || !Array.isArray(input.sections) || input.sections.length > 20) throw new Error("Confira as seções e os destaques.")
  const sections = input.sections.map(raw => {
    const section = record(raw)
    const id = text(section.id, 40)
    const title = text(section.title, 80)
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(id) || !title || !["row", "cards"].includes(section.layout as string)) throw new Error("Seção inválida.")
    return { id, title, layout: section.layout as LinkSection["layout"] }
  })
  if (new Set(sections.map(section => section.id)).size !== sections.length) throw new Error("As seções precisam ter identificadores diferentes.")
  function selections(key: "featured" | "readings", limit: number): ContentSelection[] {
    const raw = input[key]
    if (!Array.isArray(raw) || raw.length > limit) throw new Error(`Confira a seleção de ${key === "featured" ? "destaques" : "leituras"}.`)
    const entries = raw.map(parseSelection)
    if (key === "featured" && entries.some(entry => entry.kind === "link")) throw new Error("O carrossel aceita textos e notas do site.")
    if (new Set(entries.map(entry => `${entry.kind}:${entry.id}`)).size !== entries.length) throw new Error("O mesmo conteúdo foi selecionado duas vezes.")
    return entries
  }
  return {
    heading: text(input.heading, 300), intro: text(input.intro, 500),
    metaTitle: text(input.metaTitle, 180), metaDescription: text(input.metaDescription, 500),
    featuredHeading: text(input.featuredHeading, 100), readingsHeading: text(input.readingsHeading, 100),
    includeLatest: input.includeLatest, sections, featured: selections("featured", 2), readings: selections("readings", 20),
  }
}
export function contentSelection(content: LinkContent): ContentSelection {
  return { kind: content.kind, id: content.id, title: "", description: "", coverMode: "original", cover: "", coverAlt: "" }
}
export function selectFeatured(latest: LinkContent | null, selected: LinkContent[]): LinkContent[] {
  const result: LinkContent[] = []
  const seen = new Set<string>()
  for (const item of [...(latest ? [latest] : []), ...selected]) {
    const key = `${item.kind}:${item.id}`
    if (!seen.has(key)) { seen.add(key); result.push(item) }
  }
  return result.slice(0, 3)
}
