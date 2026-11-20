import assert from "node:assert/strict"
import test from "node:test"

// Keep deployment credentials out of mock requests and assertion diagnostics.
test.beforeEach(() => { delete process.env.GO_API_AUTOMATION_BYPASS_SECRET })
import { GoAdminError, goAdminOrigin, requestGoAdmin } from "../src/lib/go-admin.ts"

test("API automation bypass preserves Clerk authentication and stays in server headers", async t => {
  const previous = process.env.GO_API_AUTOMATION_BYPASS_SECRET
  process.env.GO_API_AUTOMATION_BYPASS_SECRET = "automation-secret"
  t.after(() => {
    if (previous === undefined) delete process.env.GO_API_AUTOMATION_BYPASS_SECRET
    else process.env.GO_API_AUTOMATION_BYPASS_SECRET = previous
  })
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.search, "")
    assert.equal(options.headers["x-vercel-protection-bypass"], "automation-secret")
    assert.equal(options.headers.Authorization, "Bearer session-token")
    assert.equal(options.redirect, "error")
    return Response.json({ ok: true })
  })
  await requestGoAdmin(new URL("https://backend.example"), "session-token", "/v1/admin/links/settings")
})

test("admin transport sends only the session bearer and never cookies, roles or cached responses", async t => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.href, "https://backend.example/v1/admin/posts?page=1&limit=50")
    assert.deepEqual(options.headers, { Accept: "application/json", Authorization: "Bearer session-token" })
    assert.equal(options.cache, "no-store")
    assert.equal(options.redirect, "error")
    return Response.json({ items: [], total: 0 })
  })
  assert.deepEqual(await requestGoAdmin(new URL("https://backend.example"), "session-token", "/v1/admin/posts?page=1&limit=50"), { items: [], total: 0 })
})

test("admin edits preserve explicit nulls and publication state", async t => {
  const body = { title: "Texto", seoTitle: null, published: false }
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.method, "PATCH")
    assert.deepEqual(JSON.parse(options.body), body)
    assert.equal(options.headers["Content-Type"], "application/json")
    return Response.json({ ok: true })
  })
  await requestGoAdmin(new URL("https://backend.example"), "token", "/v1/admin/posts/0123456789abcdef01234567", "PATCH", body)
})

test("links use the authenticated transport with constrained routes", async t => {
  const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.href, "https://backend.example/v1/admin/links/0123456789abcdef01234567")
    assert.equal(options.method, "PATCH")
    assert.equal(options.headers.Authorization, "Bearer token")
    assert.equal(JSON.parse(options.body).icon, "github")
    return Response.json({ ok: true })
  })
  await requestGoAdmin(new URL("https://backend.example"), "token", "/v1/admin/links/0123456789abcdef01234567", "PATCH", { icon: "github" })
  mock.mock.mockImplementation(() => { throw new Error("Unexpected request") })
  for (const path of ["/v1/admin/links/../users", "/v1/admin/links?redirect=x", "/v1/admin/links/bad-id"]) {
    await assert.rejects(requestGoAdmin(new URL("https://backend.example"), "token", path), error => error.status === 400)
  }
})

test("authentication, authorization and validation failures keep their HTTP status without leaking upstream details", async t => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({ error: "secret backend diagnostic" }, { status }))
    await assert.rejects(requestGoAdmin(new URL("https://backend.example"), "token", "/v1/admin/posts"), error => error instanceof GoAdminError && error.status === (status === 500 ? 503 : status) && !error.message.includes("secret"))
  }
})

test("links configuration, selection, ordering, health and stats use constrained authenticated routes", async t => {
  const paths = ["/v1/admin/links/settings", "/v1/admin/links/content?q=uma%20nota&limit=50", "/v1/admin/links/order", "/v1/admin/links/stats?days=7", "/v1/admin/links/0123456789abcdef01234567/check"]
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer token")
    assert.ok(paths.includes(url.pathname + url.search))
    return Response.json({ ok: true })
  })
  for (const path of paths) await requestGoAdmin(new URL("https://backend.example"), "token", path)
  for (const path of ["/v1/admin/links/content?q=x&limit=50&role=admin", "/v1/admin/links/settings/../users", "/v1/admin/links/stats?days=999", "/v1/admin/links/0123456789abcdef01234567/check?url=https://evil.example"]) {
    await assert.rejects(requestGoAdmin(new URL("https://backend.example"), "token", path), error => error.status === 400)
  }
})

test("invalid origins, missing credentials and injected route paths are refused before a request", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected network access") })
  assert.equal(goAdminOrigin(""), null)
  for (const base of ["http://remote.example", "https://user:password@backend.example", "https://backend.example/path", "https://backend.example?token=x"]) {
    assert.throws(() => goAdminOrigin(base), GoAdminError)
  }
  for (const path of ["https://evil.example/v1/admin/posts", "//evil.example", "/v1/admin/posts/../users", "/v1/admin/users", "/v1/admin/posts?redirect=x"]) {
    await assert.rejects(requestGoAdmin(new URL("https://backend.example"), "token", path), GoAdminError)
  }
  await assert.rejects(requestGoAdmin(new URL("https://backend.example"), "", "/v1/admin/posts"), error => error.status === 401)
})

test("timeouts and non-JSON upstream responses fail closed", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("network connection containing private details") })
  await assert.rejects(requestGoAdmin(new URL("https://backend.example"), "token", "/v1/admin/posts"), error => error.status === 503 && !error.message.includes("private"))
  mock.mock.mockImplementation(async () => new Response("unexpected HTML", { status: 200 }))
  await assert.rejects(requestGoAdmin(new URL("https://backend.example"), "token", "/v1/admin/posts"), error => error.status === 503)
})
