import assert from "node:assert/strict"
import test from "node:test"

// Keep deployment credentials out of mock requests and assertion diagnostics.
test.beforeEach(() => { delete process.env.GO_API_AUTOMATION_BYPASS_SECRET })
import { getAPIMural, getAPIWritingProgress } from "../src/lib/content-api.ts"

const id = "0123456789abcdef01234567"
const item = { id, content: "<p>Texto com imagem</p>", createdAt: "2026-11-16T05:54:15.565Z", updatedAt: "2026-11-16T05:54:15.565Z" }
const json = body => Response.json(body)
function setEnv(t, key, value) {
  const previous = process.env[key]
  process.env[key] = value
  t.after(() => {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  })
}

test("unconfigured API preserves the existing data source", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected network request") })
  const previous = process.env.CONTENT_API_URL
  delete process.env.CONTENT_API_URL
  try {
    assert.equal(await getAPIMural(), null)
    assert.equal(await getAPIWritingProgress(), null)
  } finally {
    if (previous !== undefined) process.env.CONTENT_API_URL = previous
  }
})

test("mural preserves HTML, order and cursor without forwarding user credentials", async t => {
  setEnv(t, "CONTENT_API_URL", "https://api.example.com")
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.href, `https://api.example.com/v1/mural?limit=20&cursor=${id}`)
    assert.deepEqual(options.headers, { Accept: "application/json" })
    assert.equal(options.cache, "no-store")
    assert.equal(options.redirect, "error")
    return json({ items: [item], total: 2, page: 1, limit: 20, nextCursor: id })
  })
  const result = await getAPIMural(id)
  assert.equal(result.items[0].content, item.content)
  assert.equal(result.nextCursor, id)
})

test("writing reads subsequent pages and projects only public fields", async t => {
  setEnv(t, "CONTENT_API_URL", "https://api.example.com/")
  let requests = 0
  t.mock.method(globalThis, "fetch", async url => {
    const page = Number(url.searchParams.get("page"))
    requests++
    return json({ items: Array.from({ length: page === 1 ? 50 : 1 }, () => ({ id, title: "Em escrita", progress: 25, private: "excluded" })), total: 51, page, limit: 50 })
  })
  const result = await getAPIWritingProgress()
  assert.equal(requests, 2)
  assert.equal(result.length, 51)
  assert.deepEqual(result[0], { id, title: "Em escrita", progress: 25 })
})

test("API failures and malformed payloads are not silently replaced with database reads", async t => {
  setEnv(t, "CONTENT_API_URL", "https://api.example.com")
  const mock = t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }))
  await assert.rejects(getAPIMural(), /503/)
  mock.mock.mockImplementation(async () => json({ items: [{ ...item, id: "bad" }], total: 1, page: 1, limit: 20, nextCursor: null }))
  await assert.rejects(getAPIMural(), /Invalid Content API/)
  mock.mock.mockImplementation(async () => json({ items: [item], total: 1, page: 1, limit: 20, nextCursor: "bad" }))
  await assert.rejects(getAPIMural(), /cursor response/)
})

test("API configuration rejects credentials, HTTP remote origins and path prefixes", async t => {
  for (const url of ["http://api.example.com", "https://user:password@api.example.com", "https://api.example.com/private", "https://api.example.com/?key=secret"]) {
    setEnv(t, "CONTENT_API_URL", url)
    await assert.rejects(getAPIMural())
  }
})
