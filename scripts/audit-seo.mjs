import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) throw new Error("MONGODB_URI is not set")

function plainText(markdown = "") {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function description(markdown = "") {
  const text = plainText(markdown)
  if (text.length <= 155) return text
  const candidate = text.slice(0, 156)
  return `${candidate.slice(0, candidate.lastIndexOf(" ") || 155).trim()}...`
}

function markdownImages(markdown = "") {
  return [...markdown.matchAll(/!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((match) => ({ alt: match[1].trim(), url: match[2] }))
}

function markdownLinks(markdown = "") {
  return [...markdown.matchAll(/(?<!!)\[[^\]]+]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((match) => match[1])
}

function normalizedPath(value) {
  try {
    const url = new URL(value, "https://domenyk.com")
    return url.origin === "https://domenyk.com" ? decodeURIComponent(url.pathname) : null
  } catch {
    return null
  }
}

const issues = []
function report(level, scope, message) {
  issues.push({ level, scope, message })
}

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db("blog")
  const [posts, notes] = await Promise.all([
    db.collection("posts").find({ deleting: { $ne: true } }).toArray(),
    db.collection("notes").find({ deleting: { $ne: true } }).toArray(),
  ])
  const publishedPosts = posts.filter((post) => post.published && post.hiddenFromTimeline !== true)
  const publishedTranslations = posts.flatMap((post) =>
    Object.entries(post.translations ?? {})
      .filter(([, translation]) => translation?.published && post.hiddenFromTimeline !== true)
      .map(([locale, translation]) => ({ post, locale, translation })))
  const knownPaths = new Set([
    "/", "/notes", "/sobre", "/fale-comigo",
    ...publishedPosts.map((post) => `/posts/${post.slug}`),
    ...notes.map((note) => `/notes/${note._id.toString()}`),
    ...publishedTranslations.map(({ post, locale, translation }) => `/${locale}/posts/${translation.slug ?? post.slug}`),
  ])

  const slugCounts = new Map()
  for (const post of posts) slugCounts.set(post.slug, (slugCounts.get(post.slug) ?? 0) + 1)
  for (const [slug, count] of slugCounts) {
    if (count > 1) report("error", `post:${slug}`, `slug duplicado em ${count} documentos`)
  }

  function auditArticle({ scope, title, seoTitle, seoDescription, content, excerpt, subtitle, cover, tags, sources, publishedAt, updatedAt }) {
    const searchTitle = seoTitle?.trim() || title?.trim()
    const fallbackDescription = seoDescription?.trim() || excerpt?.trim() || subtitle?.trim() || description(content)
    if (!title?.trim()) report("error", scope, "título editorial ausente")
    if (!searchTitle) report("error", scope, "título SEO vazio")
    else if (searchTitle.length < 30) report("warning", scope, `título SEO curto (${searchTitle.length} caracteres)`)
    else if (searchTitle.length > 60) report("warning", scope, `título SEO longo (${searchTitle.length} caracteres)`)
    if (!content?.trim()) report("error", scope, "conteúdo vazio")
    if (!fallbackDescription) report("error", scope, "descrição SEO vazia")
    else if (fallbackDescription.length < 50) report("warning", scope, `descrição curta (${fallbackDescription.length} caracteres)`)
    else if (fallbackDescription.length > 170) report("warning", scope, `descrição longa (${fallbackDescription.length} caracteres)`)
    if (!publishedAt) report("error", scope, "data de publicação ausente")
    if (!updatedAt) report("error", scope, "data de modificação ausente")
    if (cover?.url && !cover.alt?.trim()) report("warning", scope, "capa depende do fallback de texto alternativo; descreva o que aparece na imagem")
    if (cover?.url && cover.alt?.trim() === title?.trim()) {
      report("warning", scope, "texto alternativo da capa repete o título; descreva o que aparece na imagem")
    }
    if (!Array.isArray(tags) || tags.length === 0) report("warning", scope, "sem tags para descoberta e conteúdos relacionados")
    for (const source of sources ?? []) {
      try {
        if (new URL(source.url).protocol !== "https:") throw new Error()
      } catch {
        report("error", scope, `fonte inválida: ${source?.url ?? "sem URL"}`)
      }
    }
    for (const image of markdownImages(content)) {
      if (!image.alt) report("warning", scope, `imagem no corpo depende do fallback contextual de texto alternativo: ${image.url}`)
    }
    for (const href of markdownLinks(content)) {
      const path = normalizedPath(href)
      if (path && !knownPaths.has(path) && !path.startsWith("/temas/")) {
        report("warning", scope, `link interno não corresponde a conteúdo publicado: ${path}`)
      }
    }
  }

  for (const post of publishedPosts) {
    auditArticle({ scope: `post:${post.slug}:pt`, ...post })
    for (const [locale, translation] of Object.entries(post.translations ?? {})) {
      if (!translation?.published) continue
      auditArticle({
        scope: `post:${post.slug}:${locale}`,
        ...translation,
        cover: post.cover ? { url: post.cover.url, alt: translation.coverAlt ?? post.cover.alt } : undefined,
      })
      const originalUpdatedAt = post.originalContentUpdatedAt ?? post.updatedAt
      if (new Date(translation.sourceUpdatedAt).getTime() < new Date(originalUpdatedAt).getTime()) {
        report("warning", `post:${post.slug}:${locale}`, "tradução publicada está desatualizada em relação ao original")
      }
    }
  }

  for (const note of notes.filter((item) => item.seoTitle?.trim() && item.seoDescription?.trim())) {
    const scope = `note:${note._id}`
    if (note.seoTitle.trim().length > 60) report("warning", scope, `título SEO longo (${note.seoTitle.trim().length} caracteres)`)
    if (note.seoDescription.trim().length > 170) report("warning", scope, `descrição SEO longa (${note.seoDescription.trim().length} caracteres)`)
    for (const image of markdownImages(note.content)) {
      if (!image.alt) report("warning", scope, `imagem no corpo depende do fallback contextual de texto alternativo: ${image.url}`)
    }
    if (note.images?.length) {
      report("warning", scope, `${note.images.length} imagem(ns) de galeria usam texto alternativo derivado da nota, não uma descrição própria`)
    }
    for (const href of markdownLinks(note.content)) {
      const path = normalizedPath(href)
      if (path && !knownPaths.has(path) && !path.startsWith("/temas/")) {
        report("warning", scope, `link interno não corresponde a conteúdo publicado: ${path}`)
      }
    }
  }

  const summary = {
    posts: posts.length,
    publishedPosts: publishedPosts.length,
    publishedTranslations: publishedTranslations.length,
    notes: notes.length,
    covers: publishedPosts.filter((post) => post.cover?.url).length,
    bodyImages: publishedPosts.reduce((total, post) => total + markdownImages(post.content).length, 0) +
      notes.reduce((total, note) => total + markdownImages(note.content).length, 0),
    galleryImages: notes.reduce((total, note) => total + (note.images?.length ?? 0), 0),
    errors: issues.filter((issue) => issue.level === "error").length,
    warnings: issues.filter((issue) => issue.level === "warning").length,
  }
  console.log(JSON.stringify({ summary, issues }, null, 2))
  if (summary.errors > 0) process.exitCode = 1
} finally {
  await client.close()
}
