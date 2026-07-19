import assert from "node:assert/strict"
import test from "node:test"

import { resetOnRejection } from "../src/lib/retryable-promise.ts"

test("resets failed asynchronous initialization and preserves its error", async () => {
  const initializationError = new Error("temporary failure")
  let resets = 0

  const retryable = resetOnRejection(
    Promise.reject(initializationError),
    () => { resets += 1 }
  )

  await assert.rejects(retryable, (error) => error === initializationError)
  assert.equal(resets, 1)
})

test("does not reset successful asynchronous initialization", async () => {
  let resets = 0
  const value = await resetOnRejection(
    Promise.resolve("connected"),
    () => { resets += 1 }
  )

  assert.equal(value, "connected")
  assert.equal(resets, 0)
})

test("keeps the initialization error when cleanup also fails", async () => {
  const initializationError = new Error("connection failed")

  await assert.rejects(
    resetOnRejection(Promise.reject(initializationError), () => {
      throw new Error("cleanup failed")
    }),
    (error) => error === initializationError
  )
})
