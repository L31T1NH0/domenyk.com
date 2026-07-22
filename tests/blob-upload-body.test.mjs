import assert from "node:assert/strict"
import test from "node:test"
import { unsharedImageUploadBody } from "../src/lib/blob-upload-body.ts"

test("copies a shared native buffer into an ordinary ArrayBuffer", () => {
  const sharedBytes = new Uint8Array(new SharedArrayBuffer(5))
  sharedBytes.set([11, 22, 33, 44, 55])
  const nativeBuffer = Buffer.from(
    sharedBytes.buffer,
    sharedBytes.byteOffset + 1,
    3,
  )

  const body = unsharedImageUploadBody(nativeBuffer)

  assert.ok(body instanceof ArrayBuffer)
  assert.equal(body instanceof SharedArrayBuffer, false)
  assert.deepEqual([...new Uint8Array(body)], [22, 33, 44])
})

test("copies only the visible bytes of a sliced Buffer", () => {
  const pooled = Buffer.from([1, 2, 3, 4, 5])
  const body = unsharedImageUploadBody(pooled.subarray(1, 4))

  assert.ok(body instanceof ArrayBuffer)
  assert.deepEqual([...new Uint8Array(body)], [2, 3, 4])
})

test("keeps an already immutable Blob body", () => {
  const blob = new Blob(["image"], { type: "image/webp" })

  assert.equal(unsharedImageUploadBody(blob), blob)
})
