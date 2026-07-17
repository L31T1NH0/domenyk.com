import assert from "node:assert/strict"
import test from "node:test"

import {
  isMutationMethod,
  isSameOriginRequest,
  shouldBlockApiMutation,
} from "../src/lib/csrf.ts"

function request({ method = "POST", origin, referer, site } = {}) {
  return {
    method,
    url: "https://domenyk.com/api/example",
    headers: new Headers({
      ...(origin ? { origin } : {}),
      ...(referer ? { referer } : {}),
      ...(site ? { "sec-fetch-site": site } : {}),
    }),
  }
}

test("classifies only unsafe HTTP methods as mutations", () => {
  assert.equal(isMutationMethod("GET"), false)
  assert.equal(isMutationMethod("HEAD"), false)
  assert.equal(isMutationMethod("OPTIONS"), false)
  assert.equal(isMutationMethod("POST"), true)
  assert.equal(isMutationMethod("PATCH"), true)
  assert.equal(isMutationMethod("DELETE"), true)
})

test("accepts same-origin mutation metadata", () => {
  assert.equal(isSameOriginRequest(request({ origin: "https://domenyk.com", site: "same-origin" }), true), true)
  assert.equal(isSameOriginRequest(request({ site: "same-origin" }), true), true)
  assert.equal(isSameOriginRequest(request({ referer: "https://domenyk.com/admin" }), true), true)
})

test("rejects cross-site, sibling-origin, malformed, and missing metadata", () => {
  assert.equal(isSameOriginRequest(request({ origin: "https://evil.example", site: "cross-site" }), true), false)
  assert.equal(isSameOriginRequest(request({ origin: "https://preview.domenyk.com", site: "same-site" }), true), false)
  assert.equal(isSameOriginRequest(request({ origin: "null" }), true), false)
  assert.equal(isSameOriginRequest(request(), true), false)
})

test("blocks only unsafe API requests with invalid origin metadata", () => {
  assert.equal(shouldBlockApiMutation(request({ method: "POST", site: "cross-site" }), true), true)
  assert.equal(shouldBlockApiMutation(request({ method: "DELETE", site: "same-site" }), true), true)
  assert.equal(shouldBlockApiMutation(request({ method: "GET", site: "cross-site" }), true), false)
})
