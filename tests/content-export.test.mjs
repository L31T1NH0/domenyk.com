import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"

import { messageThreadToMarkdown, noteToMarkdown } from "../src/lib/content-export.ts"

test("exports a note with archival metadata and its original Markdown", () => {
  const rootId = new ObjectId()
  const previousId = new ObjectId()
  const note = noteToMarkdown({
    _id: new ObjectId(),
    title: "Uma nota curta",
    seoTitle: "Título de busca",
    seoDescription: "Descrição de busca",
    content: "Texto com **ênfase**.",
    images: ["https://example.com/image.jpg"],
    publishedAt: new Date("2026-07-24T14:00:00.000Z"),
    createdAt: new Date("2026-07-24T13:58:00.000Z"),
    updatedAt: new Date("2026-07-24T14:10:00.000Z"),
    threadRootId: rootId,
    previousNoteId: previousId,
    threadPosition: 2,
  })

  assert.match(note, /type: note/)
  assert.match(note, /title: "Uma nota curta"/)
  assert.match(note, new RegExp(`threadRootId: "${rootId}"`))
  assert.match(note, /threadPosition: 2/)
  assert.match(note, /images:\n  - "https:\/\/example\.com\/image\.jpg"/)
  assert.ok(note.endsWith("Texto com **ênfase**."))
})

test("exports a complete conversation in chronological reading order", () => {
  const thread = messageThreadToMarkdown({
    _id: new ObjectId(),
    ownerId: "reader_1",
    ownerName: "Leitora",
    subject: "Sugestão de pauta",
    category: "topic",
    status: "answered",
    createdAt: new Date("2026-07-23T10:00:00.000Z"),
    updatedAt: new Date("2026-07-23T10:05:00.000Z"),
    archivedAt: new Date("2026-07-24T10:00:00.000Z"),
    entries: [
      {
        _id: new ObjectId(),
        authorId: "reader_1",
        authorName: "Leitora",
        body: "Primeira mensagem.",
        createdAt: new Date("2026-07-23T10:00:00.000Z"),
        readAt: new Date("2026-07-23T10:02:00.000Z"),
      },
      {
        _id: new ObjectId(),
        authorId: "admin_1",
        authorName: "Domenyk",
        body: "Resposta.",
        createdAt: new Date("2026-07-23T10:05:00.000Z"),
      },
    ],
  })

  assert.match(thread, /type: conversation/)
  assert.match(thread, /subject: "Sugestão de pauta"/)
  assert.match(thread, /archivedAt: "2026-07-24T10:00:00.000Z"/)
  assert.ok(thread.indexOf("Primeira mensagem.") < thread.indexOf("Resposta."))
  assert.match(thread, /lida em 2026-07-23T10:02:00.000Z/)
})
