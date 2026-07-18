import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"

import { groupNotesByThread, mergeNotesById, serializeNoteThread } from "../src/lib/note-thread.ts"

test("serializes note thread relationships without leaking Mongo values", () => {
  const rootId = new ObjectId()
  const previousNoteId = new ObjectId()
  const thread = serializeNoteThread({
    threadRootId: rootId,
    previousNoteId,
    threadPosition: 3,
  })

  assert.deepEqual(thread, {
    rootId: rootId.toString(),
    previousId: previousNoteId.toString(),
    position: 3,
  })
})

test("keeps standalone notes free of thread metadata", () => {
  assert.equal(serializeNoteThread({}), undefined)
})

test("groups separated timeline notes into one ordered thread", () => {
  const rootId = "root"
  const groups = groupNotesByThread([
    { _id: "second", thread: { rootId, previousId: rootId, position: 2 } },
    { _id: "standalone" },
    { _id: rootId, thread: { rootId, position: 1 } },
  ])

  assert.deepEqual(groups.map((group) => group.map((note) => note._id)), [
    [rootId, "second"],
    ["standalone"],
  ])
})

test("merges linked thread members without duplicating visible notes", () => {
  const current = [{ _id: "root", value: "old" }, { _id: "other", value: "same" }]
  const merged = mergeNotesById(current, [
    { _id: "root", value: "updated" },
    { _id: "linked", value: "new" },
  ])

  assert.deepEqual(merged, [
    { _id: "root", value: "updated" },
    { _id: "other", value: "same" },
    { _id: "linked", value: "new" },
  ])
})
