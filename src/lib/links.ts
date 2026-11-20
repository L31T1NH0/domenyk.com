export const LINK_ICONS = {
  favicon: "Ícone do site", link: "Link", document: "Documento / blog", instagram: "Instagram", twitter: "Twitter",
  github: "GitHub", youtube: "YouTube", mail: "E-mail", code: "Código", globe: "Site", book: "Livro",
  threads: "Threads", whatsapp: "WhatsApp", telegram: "Telegram",
  music: "Música", podcast: "Podcast", photo: "Fotografia", video: "Vídeo",
  chat: "Comunidade", calendar: "Agenda", location: "Localização",
  shop: "Loja", heart: "Favoritos", star: "Destaque", rss: "RSS",
} as const

export const LINK_SECTIONS = { content: "Conteúdo", social: "Redes e contato" } as const

export type LinkInput = {
  title: string
  description: string
  url: string
  icon: keyof typeof LINK_ICONS
  section: string
  order: number
  published: boolean
  appearance: "simple" | "description" | "image"
  cover: string
  coverAlt: string
  startsAt: string | null
  endsAt: string | null
}

export type SiteLink = LinkInput & { id: string; clicks?: number; health?: string; checkedAt?: string }

export function isSafeLinkURL(value: string): boolean {
  if (!value || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return false
  if (value.startsWith("/")) return !value.startsWith("//")
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password
  } catch { return false }
}

export function normalizeLinkURL(value: string): string {
  const url = value.trim()
  if (!url || url.startsWith("/") || /^[a-z][a-z\d+.-]*:/i.test(url)) return url
  return `https://${url}`
}

export function suggestLinkTitle(value: string): string {
  const url = normalizeLinkURL(value)
  if (!isSafeLinkURL(url) || url.startsWith("/")) return ""
  return new URL(url).hostname.replace(/^www\./, "").slice(0, 100)
}

export function linkFaviconURL(value: string): string | null {
  if (!isSafeLinkURL(value)) return null
  if (value.startsWith("/")) return "/favicon.ico"
  // shortcut: Google resolves external favicons; use a self-hosted resolver if that dependency becomes unsuitable.
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(value).hostname)}&sz=64`
}

export function parseLinkInput(value: unknown): LinkInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dados do link inválidos.")
  const input = value as Record<string, unknown>
  const strings: Record<string, string> = {}
  for (const [key, limit] of Object.entries({ title: 100, description: 180, url: 2048, icon: 30, section: 40 })) {
    if (typeof input[key] !== "string") throw new Error(`Campo inválido: ${key}.`)
    const text = input[key].trim()
    if ([...text].length > limit || (key !== "description" && !text)) throw new Error(`Confira o campo ${key}.`)
    strings[key] = text
  }
  if (!isSafeLinkURL(strings.url)) throw new Error("Use uma URL HTTPS ou um caminho interno, como /notes.")
  // Old LinkedIn records remain readable; the picker no longer offers this icon.
  if (strings.icon === "linkedin") strings.icon = "globe"
  if (!Object.hasOwn(LINK_ICONS, strings.icon) || !/^[a-z][a-z0-9-]{0,39}$/.test(strings.section)) throw new Error("Escolha um ícone e uma seção válidos.")
  if (!Number.isSafeInteger(input.order) || (input.order as number) < 0 || (input.order as number) > 10000) throw new Error("A ordem deve ser um inteiro entre 0 e 10000.")
  if (typeof input.published !== "boolean") throw new Error("Estado de publicação inválido.")
  const appearance = input.appearance ?? "description"
  if (!["simple", "description", "image"].includes(appearance as string)) throw new Error("Aparência inválida.")
  if ((input.cover !== undefined && typeof input.cover !== "string") || (input.coverAlt !== undefined && typeof input.coverAlt !== "string")) throw new Error("Capa inválida.")
  const cover = typeof input.cover === "string" ? input.cover.trim() : ""
  const coverAlt = typeof input.coverAlt === "string" ? input.coverAlt.trim() : ""
  if ((cover && (!isSafeLinkURL(cover) || cover.length > 2048)) || coverAlt.length > 180) throw new Error("Capa inválida.")
  const startsAt = linkDate(input.startsAt)
  const endsAt = linkDate(input.endsAt)
  if (startsAt && endsAt && startsAt >= endsAt) throw new Error("O término deve ser posterior ao início.")
  return {
    title: strings.title, description: strings.description, url: strings.url,
    icon: strings.icon as LinkInput["icon"], section: strings.section as LinkInput["section"],
    order: input.order as number, published: input.published,
    appearance: appearance as LinkInput["appearance"], cover, coverAlt, startsAt, endsAt,
  }
}

function linkDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== value.slice(0, 10)) throw new Error("Data de publicação inválida.")
  return new Date(value).toISOString()
}

export function canonicalLinkURL(value: string): string {
  const normalized = normalizeLinkURL(value)
  if (!isSafeLinkURL(normalized)) return normalized
  const url = new URL(normalized, "https://internal.invalid")
  url.hash = ""
  url.pathname = url.pathname.replace(/\/+$/, "") || "/"
  url.searchParams.sort()
  return normalized.startsWith("/") ? url.pathname + url.search : url.href
}
