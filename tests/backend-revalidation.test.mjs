import assert from "node:assert/strict"
import test from "node:test"
import { backendRevalidationPaths, isBackendRevalidationAuthorized } from "../src/lib/backend-revalidation.ts"

const secret = "a-long-revalidation-secret-for-the-go-api"
test("backend callback requires the configured service credential", () => {
  assert.equal(isBackendRevalidationAuthorized(`Bearer ${secret}`, secret), true)
  for (const header of [null, "Bearer wrong", "admin", `Basic ${secret}`]) {
    assert.equal(isBackendRevalidationAuthorized(header, secret), false)
  }
  assert.equal(isBackendRevalidationAuthorized(`Bearer ${secret}`, undefined), false)
  assert.equal(isBackendRevalidationAuthorized("Bearer weak", "weak"), false)
})
test("callback accepts only bounded local paths", () => {
  assert.deepEqual(backendRevalidationPaths({ paths: ["/", "/posts/example", "/"] }), ["/", "/posts/example"])
  for (const value of [null, { paths: ["https://evil.example"] }, { paths: ["//evil.example"] }, { paths: ["/?token=x"] }, { paths: ["/".repeat(1025)] }, { paths: ["/"], tag: "private" }, { paths: Array(65).fill("/") }]) {
    assert.equal(backendRevalidationPaths(value), null)
  }
})
