import type { Note } from "./db/notes"
import type { PostSummary } from "./db/posts"
import type { Theme } from "./db/themes"
import {
  POST_LOCALE_DETAILS,
  TRANSLATION_LOCALES,
  localizedPostPath,
  type PostLocale,
} from "./post-locales"
import { postSeoDescription, postSeoTitle } from "./post-seo"
import { absoluteUrl, descriptionFromMarkdown, metadataDescription, noteDisplayTitle, siteConfig } from "./seo"

type LlmsTxtInput = {
  posts: PostSummary[]
  themes: Array<Pick<Theme, "name" | "slug" | "description">>
  notes: Array<Pick<Note, "_id" | "title" | "seoTitle" | "seoDescription" | "content">>
}

type LlmsPostVersion = {
  title: string
  seoTitle?: string
  seoDescription?: string
  excerpt?: string
  subtitle?: string
}

function markdownLabel(value: string): string {
  return value.replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim()
}

function linkLine(label: string, path: string, description: string): string {
  return `- [${markdownLabel(label)}](${absoluteUrl(path)}): ${metadataDescription(description, 220)}`
}

function localizedPosts(posts: PostSummary[], locale: PostLocale): Array<{
  post: PostSummary
  version: LlmsPostVersion
}> {
  const entries: Array<{ post: PostSummary; version: LlmsPostVersion }> = []

  for (const post of posts) {
    if (locale === "pt") {
      if (post.published) entries.push({ post, version: post })
      continue
    }

    const translation = post.translations?.[locale]
    if (translation?.published) entries.push({ post, version: translation })
  }

  return entries
}

export function buildLlmsTxt({ posts, themes, notes }: LlmsTxtInput): string {
  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    "Domenyk publica ensaios e notas sobre política, economia, liberalismo, filosofia, instituições e tecnologia. Os textos identificam agentes, incentivos e consequências.",
    "",
    "## Páginas principais",
    "",
    linkLine("Início", "/", "Linha do tempo com posts e notas publicados."),
    linkLine("Sobre Domenyk", "/sobre", "Trajetória intelectual, temas de estudo e método de análise do autor."),
    linkLine("Notas", "/notes", "Registros curtos, hipóteses e argumentos em desenvolvimento."),
  ]

  if (themes.length > 0) {
    lines.push("", "## Temas", "")
    for (const theme of themes) {
      lines.push(linkLine(theme.name, `/temas/${encodeURIComponent(theme.slug)}`, theme.description))
    }
  }

  for (const locale of ["pt", ...TRANSLATION_LOCALES] as const) {
    const entries = localizedPosts(posts, locale)
    if (entries.length === 0) continue

    const heading = locale === "pt"
      ? "Textos em português"
      : `Textos em ${POST_LOCALE_DETAILS[locale].nativeLabel}`
    lines.push("", `## ${heading}`, "")

    for (const { post, version } of entries) {
      const description = postSeoDescription(version, siteConfig.description)
      lines.push(linkLine(
        postSeoTitle(version),
        localizedPostPath(post, locale),
        description
      ))
    }
  }

  if (notes.length > 0) {
    lines.push("", "## Notas indexáveis", "")
    for (const note of notes) {
      lines.push(linkLine(
        note.seoTitle?.trim() || noteDisplayTitle(note),
        `/notes/${note._id.toString()}`,
        note.seoDescription?.trim() || descriptionFromMarkdown(note.content)
      ))
    }
  }

  lines.push(
    "",
    "## Informações técnicas",
    "",
    `- Idioma principal: português do Brasil (${siteConfig.locale.replace("_", "-")}).`,
    `- Autor e editor: ${siteConfig.author}.`,
    `- Sitemap: ${absoluteUrl("/sitemap/index.xml")}`,
    `- Robots: ${absoluteUrl("/robots.txt")}`,
    ""
  )

  return lines.join("\n")
}
