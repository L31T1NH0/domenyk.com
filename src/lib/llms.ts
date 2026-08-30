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
import {
  ARTICLE_COLLECTION_PATH,
  CONTENT_TYPE_DEFINITIONS,
  NOTES_COLLECTION_PATH,
} from "./editorial-content-types"

type LlmsTxtInput = {
  posts: PostSummary[]
  themes: Array<Pick<Theme, "name" | "slug" | "description">>
  notes: Array<Pick<Note, "_id" | "title" | "seoTitle" | "seoDescription" | "content" | "threadRootId" | "threadPosition">>
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
    "Domenyk publica artigos, notas e threads de notas sobre política, economia, liberalismo, filosofia, instituições e tecnologia.",
    "",
    "## Tipos de conteúdo",
    "",
    `- Artigo (\`${CONTENT_TYPE_DEFINITIONS.article.code}\`): ${CONTENT_TYPE_DEFINITIONS.article.description}`,
    `- Nota (\`${CONTENT_TYPE_DEFINITIONS.note.code}\`): ${CONTENT_TYPE_DEFINITIONS.note.description}`,
    `- Thread de notas (\`${CONTENT_TYPE_DEFINITIONS.thread.code}\`): ${CONTENT_TYPE_DEFINITIONS.thread.description}`,
    "- As URLs individuais de artigos mantêm o segmento técnico `/posts/` por compatibilidade; semanticamente, esses textos são artigos.",
    "",
    "## Páginas principais",
    "",
    linkLine("Início", "/", "Coleção mista de artigos, notas autônomas e threads de notas."),
    linkLine("Artigos", ARTICLE_COLLECTION_PATH, "Somente artigos: textos longos, autônomos e estruturados."),
    linkLine("Notas e threads", NOTES_COLLECTION_PATH, "Somente notas autônomas e threads ordenadas de notas."),
    linkLine("Sobre Domenyk", "/sobre", "Trajetória intelectual, temas de estudo e método de análise do autor."),
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
      ? "Artigos em português"
      : `Artigos em ${POST_LOCALE_DETAILS[locale].nativeLabel}`
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
    const listedThreads = new Set<string>()
    for (const note of notes) {
      const threadRootId = note.threadRootId?.toString()
      if (threadRootId && listedThreads.has(threadRootId)) continue
      if (threadRootId) listedThreads.add(threadRootId)
      const representative = threadRootId
        ? notes.find((candidate) => candidate._id.toString() === threadRootId) ?? note
        : note
      const contentType = threadRootId ? "Thread de notas" : "Nota"
      lines.push(linkLine(
        `${contentType} — ${representative.seoTitle?.trim() || noteDisplayTitle(representative)}`,
        `/notes/${representative._id.toString()}`,
        `Tipo: ${threadRootId ? CONTENT_TYPE_DEFINITIONS.thread.code : CONTENT_TYPE_DEFINITIONS.note.code}. ${representative.seoDescription?.trim() || descriptionFromMarkdown(representative.content)}`
      ))
    }
  }

  lines.push(
    "",
    "## Informações técnicas",
    "",
    `- Idioma principal: português do Brasil (${siteConfig.locale.replace("_", "-")}).`,
    `- Autor e editor: ${siteConfig.author}.`,
    `- Coleção canônica de artigos: ${absoluteUrl(ARTICLE_COLLECTION_PATH)}`,
    `- Coleção canônica de notas e threads: ${absoluteUrl(NOTES_COLLECTION_PATH)}`,
    `- Sitemap: ${absoluteUrl("/sitemap/index.xml")}`,
    `- Robots: ${absoluteUrl("/robots.txt")}`,
    ""
  )

  return lines.join("\n")
}
