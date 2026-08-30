export type EditorialFeedMode = "all" | "posts" | "notes"
export type EditorialContentType = "article" | "note" | "thread"

export const ARTICLE_COLLECTION_PATH = "/?mode=posts"
export const NOTES_COLLECTION_PATH = "/?mode=notes"

export const CONTENT_TYPE_DEFINITIONS = {
  article: {
    code: "article",
    name: "Artigo",
    description: "Texto longo, autônomo e estruturado, desenvolvido como uma publicação editorial completa.",
  },
  note: {
    code: "note",
    name: "Nota",
    description: "Publicação curta e autônoma que registra uma ideia, observação, hipótese ou argumento breve.",
  },
  thread: {
    code: "note-thread",
    name: "Thread de notas",
    description: "Sequência ordenada de duas ou mais notas relacionadas. Cada parte continua sendo uma nota e a ordem faz parte do conteúdo.",
  },
} as const

export function collectionPath(mode: EditorialFeedMode): string {
  if (mode === "posts") return ARTICLE_COLLECTION_PATH
  if (mode === "notes") return NOTES_COLLECTION_PATH
  return "/"
}

export function collectionDefinition(mode: EditorialFeedMode) {
  if (mode === "posts") {
    return {
      name: "Artigos",
      description: "Coleção de artigos de Domenyk: textos longos, autônomos e estruturados.",
      contentTypeKeys: ["article"] satisfies EditorialContentType[],
      machineTypes: "article",
    }
  }

  if (mode === "notes") {
    return {
      name: "Notas e threads",
      description: "Coleção de notas de Domenyk, incluindo notas autônomas e threads ordenadas de notas relacionadas.",
      contentTypeKeys: ["note", "thread"] satisfies EditorialContentType[],
      machineTypes: "note, note-thread",
    }
  }

  return {
    name: "Publicações de Domenyk",
    description: "Coleção mista de artigos, notas autônomas e threads de notas de Domenyk.",
    contentTypeKeys: ["article", "note", "thread"] satisfies EditorialContentType[],
    machineTypes: "article, note, note-thread",
  }
}

export function collectionMachineMetadata(mode: EditorialFeedMode): Record<string, string> {
  const definition = collectionDefinition(mode)
  return {
    "domenyk:page-kind": "content-collection",
    "domenyk:collection": mode === "posts" ? "articles" : mode === "notes" ? "notes" : "mixed",
    "domenyk:content-types": definition.machineTypes,
  }
}

export function articleMachineMetadata(): Record<string, string> {
  return {
    "domenyk:page-kind": "editorial-content",
    "domenyk:content-type": CONTENT_TYPE_DEFINITIONS.article.code,
    "domenyk:content-format": "long-form",
  }
}

export function noteMachineMetadata(isThread: boolean, noteCount?: number): Record<string, string> {
  return {
    "domenyk:page-kind": "editorial-content",
    "domenyk:content-type": isThread
      ? CONTENT_TYPE_DEFINITIONS.thread.code
      : CONTENT_TYPE_DEFINITIONS.note.code,
    "domenyk:content-format": isThread ? "ordered-notes" : "standalone-note",
    ...(isThread && noteCount ? { "domenyk:note-count": String(noteCount) } : {}),
  }
}
