import assert from "node:assert/strict"
import test from "node:test"
import { LINK_ICONS, isSafeLinkURL, normalizeLinkURL, suggestLinkTitle, linkFaviconURL, parseLinkInput } from "../src/lib/links.ts"
import { fetchLatestNote } from "../src/lib/latest-note.ts"

const input = { appearance: "description", cover: "", coverAlt: "", startsAt: null, endsAt: null, title: "GitHub", description: "Projetos", url: "https://github.com/example", icon: "github", section: "social", order: 0, published: true }
const id = "0123456789abcdef01234567"

test("links accept HTTPS and internal paths and reject executable or ambiguous URLs", () => {
  for (const url of ["/", "/notes", "/?mode=posts", "https://github.com/example"]) assert.equal(isSafeLinkURL(url), true, url)
  for (const url of ["javascript:alert(1)", "data:text/html,x", "//evil.example", "/\\evil.example", "https://user:password@example.com", "http://example.com", "https://exa\nmple.com", ""]) assert.equal(isSafeLinkURL(url), false, url)
})

test("link input restricts icon, section, order and publication state and projects fields", () => {
  for (const icon of Object.keys(LINK_ICONS)) assert.equal(parseLinkInput({ ...input, icon }).icon, icon)
  assert.deepEqual(parseLinkInput({ ...input, title: " GitHub ", id, $set: { published: false } }), input)
  for (const bad of [{ title: " " }, { title: "a".repeat(101) }, { icon: "__proto__" }, { section: "__proto__" }, { order: -1 }, { order: 0.1 }, { order: NaN }, { order: 10001 }, { published: "true" }, { url: "javascript:alert(1)" }]) assert.throws(() => parseLinkInput({ ...input, ...bad }))
})

test("latest note consumes the API and projects only the first note", async t => {
  const signal = new AbortController().signal
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/links/latest-note")
    assert.equal(options.signal, signal)
    return Response.json({ notes: [{ _id: id, content: "Nota mais recente", publishedAt: "2026-11-19T12:00:00Z", secret: "excluded" }, { _id: "older" }] })
  })
  assert.deepEqual(await fetchLatestNote(signal), { id, content: "Nota mais recente", publishedAt: "2026-11-19T12:00:00Z" })
})

test("latest note distinguishes an empty list from invalid data and HTTP failures", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ notes: [] }))
  assert.equal(await fetchLatestNote(), null)
  for (const body of [{}, { notes: null }, { notes: [{ _id: "bad", content: "x", publishedAt: "invalid" }] }]) {
    mock.mock.mockImplementation(async () => Response.json(body))
    await assert.rejects(fetchLatestNote())
  }
  mock.mock.mockImplementation(async () => new Response("unavailable", { status: 503 }))
  await assert.rejects(fetchLatestNote())
})


test("pasted addresses gain HTTPS without relaxing URL validation", () => {
  for (const [raw, expected] of [[" github.com/example ", "https://github.com/example"], ["www.example.com/path?q=1", "https://www.example.com/path?q=1"], [" /notes ", "/notes"], ["", ""], ["https://example.com", "https://example.com"]]) {
    assert.equal(normalizeLinkURL(raw), expected)
  }
  for (const raw of ["javascript:alert(1)", "http://example.com", "//evil.example", "https://user:pass@example.com", "data:text/html,x"]) {
    assert.equal(isSafeLinkURL(normalizeLinkURL(raw)), false, raw)
  }
  assert.equal(suggestLinkTitle("www.github.com/example"), "github.com")
  assert.equal(suggestLinkTitle("/notes"), "")
  assert.equal(suggestLinkTitle("javascript:alert(1)"), "")
})

test("favicons use only the hostname, internal links use the local icon", () => {
  assert.equal(linkFaviconURL("https://example.com/private?token=secret"), "https://www.google.com/s2/favicons?domain=example.com&sz=64")
  assert.equal(linkFaviconURL("/notes"), "/favicon.ico")
  for (const raw of ["", "//evil.example", "javascript:alert(1)", "https://user:pass@example.com"]) assert.equal(linkFaviconURL(raw), null)
})
