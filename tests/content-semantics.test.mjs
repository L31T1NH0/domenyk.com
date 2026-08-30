import assert from "node:assert/strict"
import test from "node:test"

import {
  ARTICLE_COLLECTION_PATH,
  CONTENT_TYPE_DEFINITIONS,
  NOTES_COLLECTION_PATH,
  articleMachineMetadata,
  collectionDefinition,
  collectionMachineMetadata,
  noteMachineMetadata,
} from "../src/lib/editorial-content-types.ts"

test("gives article and note filters distinct canonical collection identities", () => {
  assert.equal(ARTICLE_COLLECTION_PATH, "/?mode=posts")
  assert.equal(NOTES_COLLECTION_PATH, "/?mode=notes")
  assert.notEqual(ARTICLE_COLLECTION_PATH, NOTES_COLLECTION_PATH)
  assert.deepEqual(collectionMachineMetadata("posts"), {
    "domenyk:page-kind": "content-collection",
    "domenyk:collection": "articles",
    "domenyk:content-types": "article",
  })
})

test("defines standalone notes separately from long-form articles", () => {
  assert.equal(CONTENT_TYPE_DEFINITIONS.article.code, "article")
  assert.equal(CONTENT_TYPE_DEFINITIONS.note.code, "note")
  assert.equal(articleMachineMetadata()["domenyk:content-format"], "long-form")
  assert.equal(noteMachineMetadata(false)["domenyk:content-type"], "note")
})

test("defines a thread as ordered notes and not as a standalone note", () => {
  assert.equal(CONTENT_TYPE_DEFINITIONS.thread.code, "note-thread")
  assert.match(CONTENT_TYPE_DEFINITIONS.thread.description, /Cada parte continua sendo uma nota/)
  assert.equal(noteMachineMetadata(true, 2)["domenyk:content-type"], "note-thread")
  assert.equal(noteMachineMetadata(true, 2)["domenyk:note-count"], "2")
})

test("declares which content types belong to each collection", () => {
  assert.deepEqual(collectionDefinition("posts").contentTypeKeys, ["article"])
  assert.deepEqual(collectionDefinition("notes").contentTypeKeys, ["note", "thread"])
  assert.deepEqual(collectionDefinition("all").contentTypeKeys, ["article", "note", "thread"])
})
