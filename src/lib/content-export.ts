import type { MessageThread } from "./db/messages"
import type { Note } from "./db/notes"

function frontMatterValue(value: string) {
  return JSON.stringify(value)
}

function optionalFrontMatterValue(key: string, value?: string) {
  return value ? `${key}: ${frontMatterValue(value)}` : undefined
}

function frontMatterList(key: string, values?: string[]) {
  if (!values?.length) return `${key}: []`
  return [key + ":", ...values.map((value) => `  - ${frontMatterValue(value)}`)].join("\n")
}

export function noteToMarkdown(note: Note) {
  return [
    "---",
    "type: note",
    `id: ${frontMatterValue(note._id.toString())}`,
    optionalFrontMatterValue("title", note.title),
    optionalFrontMatterValue("seoTitle", note.seoTitle),
    optionalFrontMatterValue("seoDescription", note.seoDescription),
    `publishedAt: ${frontMatterValue(note.publishedAt.toISOString())}`,
    `createdAt: ${frontMatterValue(note.createdAt.toISOString())}`,
    `updatedAt: ${frontMatterValue((note.updatedAt ?? note.createdAt).toISOString())}`,
    note.threadRootId ? `threadRootId: ${frontMatterValue(note.threadRootId.toString())}` : undefined,
    note.previousNoteId ? `previousNoteId: ${frontMatterValue(note.previousNoteId.toString())}` : undefined,
    note.threadPosition ? `threadPosition: ${note.threadPosition}` : undefined,
    frontMatterList("images", note.images),
    "---",
    "",
    note.content,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n")
}

export function messageThreadToMarkdown(thread: MessageThread) {
  const entries = thread.entries.flatMap((entry) => [
    `## ${entry.authorName}`,
    "",
    [
      `Enviada em ${entry.createdAt.toISOString()}`,
      entry.readAt ? `lida em ${entry.readAt.toISOString()}` : undefined,
    ].filter(Boolean).join(" · "),
    "",
    entry.body,
  ])

  return [
    "---",
    "type: conversation",
    `id: ${frontMatterValue(thread._id.toString())}`,
    `subject: ${frontMatterValue(thread.subject)}`,
    `owner: ${frontMatterValue(thread.ownerName)}`,
    `category: ${frontMatterValue(thread.category)}`,
    `status: ${frontMatterValue(thread.status)}`,
    `createdAt: ${frontMatterValue(thread.createdAt.toISOString())}`,
    `updatedAt: ${frontMatterValue(thread.updatedAt.toISOString())}`,
    optionalFrontMatterValue("archivedAt", thread.archivedAt?.toISOString()),
    "---",
    "",
    `# ${thread.subject}`,
    "",
    ...entries,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n")
}
