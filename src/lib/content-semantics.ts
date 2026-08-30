import type { SerializedNoteThread } from "./note-thread"
import {
  absoluteUrl,
  descriptionFromMarkdown,
  noteDisplayTitle,
  preferredContentImages,
  siteConfig,
} from "./seo"
import {
  ARTICLE_COLLECTION_PATH,
  CONTENT_TYPE_DEFINITIONS,
  NOTES_COLLECTION_PATH,
  articleMachineMetadata,
  collectionDefinition,
  collectionMachineMetadata,
  collectionPath,
  noteMachineMetadata,
  type EditorialFeedMode,
} from "./editorial-content-types"

export {
  ARTICLE_COLLECTION_PATH,
  CONTENT_TYPE_DEFINITIONS,
  NOTES_COLLECTION_PATH,
  articleMachineMetadata,
  collectionDefinition,
  collectionMachineMetadata,
  collectionPath,
  noteMachineMetadata,
}
export type { EditorialFeedMode }

export const CONTENT_TYPE_IDS = {
  article: `${siteConfig.url}/#content-type-article`,
  note: `${siteConfig.url}/#content-type-note`,
  thread: `${siteConfig.url}/#content-type-note-thread`,
} as const

type StructuredPost = {
  slug: string
  title: string
  seoDescription?: string
  excerpt?: string
  subtitle?: string
  publishedAt?: string
  updatedAt: string
  tags?: string[]
}

export type StructuredNote = {
  _id: string
  title?: string
  seoTitle?: string
  seoDescription?: string
  content: string
  images?: string[]
  publishedAt: string
  updatedAt: string
  thread?: SerializedNoteThread
}

export function editorialVocabularyJsonLd(): Record<string, unknown>[] {
  const termSetId = `${siteConfig.url}/#editorial-content-types`
  return [
    {
      "@type": "DefinedTermSet",
      "@id": termSetId,
      name: "Tipos de conteúdo editorial de domenyk.com",
      description: "Vocabulário que distingue artigos, notas autônomas e threads de notas no site.",
      hasDefinedTerm: Object.values(CONTENT_TYPE_IDS).map((id) => ({ "@id": id })),
    },
    ...Object.entries(CONTENT_TYPE_DEFINITIONS).map(([key, definition]) => ({
      "@type": "DefinedTerm",
      "@id": CONTENT_TYPE_IDS[key as keyof typeof CONTENT_TYPE_IDS],
      termCode: definition.code,
      name: definition.name,
      description: definition.description,
      inDefinedTermSet: { "@id": termSetId },
    })),
  ]
}

function articleEntity(post: StructuredPost): Record<string, unknown> {
  const url = absoluteUrl(`/posts/${encodeURIComponent(post.slug)}`)
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    additionalType: CONTENT_TYPE_IDS.article,
    url,
    mainEntityOfPage: url,
    headline: post.title,
    description: post.seoDescription?.trim() || post.excerpt?.trim() || post.subtitle?.trim() || undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@id": `${siteConfig.url}/#person` },
    publisher: { "@id": `${siteConfig.url}/#person` },
    isPartOf: { "@id": `${absoluteUrl(ARTICLE_COLLECTION_PATH)}#collection` },
    inLanguage: "pt-BR",
    keywords: post.tags,
    isAccessibleForFree: true,
  }
}

function noteEntity(note: StructuredNote, threadId?: string): Record<string, unknown> {
  const url = absoluteUrl(`/notes/${note._id}`)
  const description = note.seoDescription?.trim() || descriptionFromMarkdown(note.content)
  const images = preferredContentImages({
    images: note.images,
    markdown: note.content,
  })
  return {
    "@type": "CreativeWork",
    "@id": `${url}#note`,
    additionalType: CONTENT_TYPE_IDS.note,
    url,
    mainEntityOfPage: url,
    name: note.seoTitle?.trim() || noteDisplayTitle(note),
    description,
    image: (images.length > 0 ? images : [siteConfig.image]).map(absoluteUrl),
    datePublished: note.publishedAt,
    dateModified: note.updatedAt,
    author: { "@id": `${siteConfig.url}/#person` },
    publisher: { "@id": `${siteConfig.url}/#person` },
    isPartOf: threadId
      ? { "@id": threadId }
      : { "@id": `${absoluteUrl(NOTES_COLLECTION_PATH)}#collection` },
    inLanguage: "pt-BR",
    isAccessibleForFree: true,
  }
}

function groupNotes(notes: StructuredNote[]): StructuredNote[][] {
  const groups = new Map<string, StructuredNote[]>()
  const order: string[] = []

  for (const note of notes) {
    const key = note.thread?.rootId ?? note._id
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)?.push(note)
  }

  return order.map((key) => (groups.get(key) ?? []).sort(
    (a, b) => (a.thread?.position ?? 1) - (b.thread?.position ?? 1)
  ))
}

function threadEntity(notes: StructuredNote[], complete: boolean): Record<string, unknown> {
  const root = notes.find((note) => note.thread?.position === 1) ?? notes[0]
  const rootId = root.thread?.rootId ?? root._id
  const url = absoluteUrl(`/notes/${rootId}`)
  const id = `${url}#thread`
  return {
    "@type": "ItemList",
    "@id": id,
    additionalType: CONTENT_TYPE_IDS.thread,
    url,
    name: root.seoTitle?.trim() || root.title?.trim() || "Thread de notas",
    description: root.seoDescription?.trim()
      || descriptionFromMarkdown(root.content)
      || CONTENT_TYPE_DEFINITIONS.thread.description,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    ...(complete ? { numberOfItems: notes.length } : {}),
    itemListElement: notes.map((note, index) => ({
      "@type": "ListItem",
      position: note.thread?.position ?? index + 1,
      item: noteEntity(note, id),
    })),
    author: { "@id": `${siteConfig.url}/#person` },
    publisher: { "@id": `${siteConfig.url}/#person` },
    isPartOf: { "@id": `${absoluteUrl(NOTES_COLLECTION_PATH)}#collection` },
    inLanguage: "pt-BR",
  }
}

function noteCollectionEntities(notes: StructuredNote[], completeThreads = false): Record<string, unknown>[] {
  const uniqueNotes = [...new Map(notes.map((note) => [note._id, note])).values()]
  return groupNotes(uniqueNotes).map((group) => (
    group[0]?.thread ? threadEntity(group, completeThreads) : noteEntity(group[0])
  ))
}

export function contentCollectionJsonLd({
  mode,
  posts = [],
  notes = [],
}: {
  mode: EditorialFeedMode
  posts?: StructuredPost[]
  notes?: StructuredNote[]
}): Record<string, unknown> {
  const definition = collectionDefinition(mode)
  const url = absoluteUrl(collectionPath(mode))
  const entities = [
    ...(mode === "notes" ? [] : posts.map(articleEntity)),
    ...(mode === "posts" ? [] : noteCollectionEntities(notes)),
  ]

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name: definition.name,
    description: definition.description,
    inLanguage: "pt-BR",
    publisher: { "@id": `${siteConfig.url}/#person` },
    isPartOf: { "@id": `${siteConfig.url}/#website` },
    about: definition.contentTypeKeys.map((key) => ({ "@id": CONTENT_TYPE_IDS[key] })),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: entities.length,
      itemListElement: entities.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item,
      })),
    },
  }
}

export function notePageJsonLd(notes: StructuredNote[], openedNoteId: string): Record<string, unknown> {
  const openedNote = notes.find((note) => note._id === openedNoteId) ?? notes[0]
  const isThread = notes.length > 1
  const noteUrl = absoluteUrl(`/notes/${openedNote._id}`)
  const mainEntity = isThread ? threadEntity(notes, true) : noteEntity(openedNote)
  const mainEntityId = mainEntity["@id"]
  const title = isThread
    ? (notes[0].seoTitle?.trim() || notes[0].title?.trim() || "Thread de notas")
    : (openedNote.seoTitle?.trim() || noteDisplayTitle(openedNote))

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${noteUrl}#webpage`,
        url: noteUrl,
        name: title,
        mainEntity: { "@id": mainEntityId },
        isPartOf: { "@id": `${siteConfig.url}/#website` },
        inLanguage: "pt-BR",
      },
      mainEntity,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Notas e threads", item: absoluteUrl(NOTES_COLLECTION_PATH) },
          { "@type": "ListItem", position: 3, name: title, item: noteUrl },
        ],
      },
    ],
  }
}
