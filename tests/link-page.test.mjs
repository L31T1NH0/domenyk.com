import assert from "node:assert/strict"
import test from "node:test"
import { contentSelection, parseLinkPageSettings, selectFeatured } from "../src/lib/link-page.ts"
import { canonicalLinkURL, parseLinkInput } from "../src/lib/links.ts"

const id = "0123456789abcdef01234567"
const content = { kind: "post", id, title: "Título do banco", description: "Descrição do banco", url: "/posts/exemplo", cover: "", coverAlt: "", publishedAt: "2026-11-20T10:00:00Z" }
const selection = contentSelection(content)
const settings = { heading: "Uma abertura\neditável", intro: "Apresentação", metaTitle: "Título", metaDescription: "Descrição", featuredHeading: "Escolhas", readingsHeading: "Para ler", includeLatest: true, sections: [{ id: "meus-projetos", title: "Meus projetos", layout: "row" }], featured: [selection], readings: [] }
test("page content and section names come entirely from editable configuration", () => {
  assert.deepEqual(parseLinkPageSettings(settings), settings)
  const changed = parseLinkPageSettings({ ...settings, heading: "Outra abertura", sections: [{ id: "outro-grupo", title: "Outro nome", layout: "cards" }], secret: "excluded" })
  assert.equal(changed.heading, "Outra abertura")
  assert.equal(changed.sections[0].title, "Outro nome")
  assert.equal(changed.secret, undefined)
  assert.equal(parseLinkPageSettings({ ...settings, heading: "", intro: "", sections: [], featured: [], readings: [] }).heading, "")
})
test("settings reject invalid selections, duplicate groups, scripts and excessive featured slots", () => {
  for (const bad of [
    { includeLatest: "true" }, { sections: [settings.sections[0], settings.sections[0]] }, { sections: [{ id: "__proto__", title: "X", layout: "row" }] },
    { featured: [selection, selection] }, { featured: [{ ...selection, kind: "link" }] }, { featured: [{ ...selection, id: "bad" }] },
    { featured: [{ ...selection, coverMode: "custom", cover: "" }] }, { readings: [{ ...selection, coverMode: "custom", cover: "javascript:alert(1)" }] },
    { featured: [selection, { ...selection, id: "1123456789abcdef01234567" }, { ...selection, id: "2123456789abcdef01234567" }] },
  ]) assert.throws(() => parseLinkPageSettings({ ...settings, ...bad }))
  assert.equal(parseLinkPageSettings({ ...settings, readings: [{ ...selection, kind: "link" }] }).readings[0].kind, "link")
})
test("featured order is recent first, then manual choices, with stable identities and no duplicates", () => {
  const note = { ...content, kind: "note" }
  const other = { ...content, id: "1123456789abcdef01234567" }
  assert.deepEqual(selectFeatured(content, [note, other]), [content, note, other])
  assert.deepEqual(selectFeatured(content, [content, other]), [content, other])
  assert.deepEqual(selectFeatured(null, [other]), [other])
  assert.deepEqual(selectFeatured(null, []), [])
})
test("link covers and schedules are validated while old records gain safe presentation defaults", () => {
  const base = { title: "Link", description: "", url: "/notes", icon: "threads", section: "meus-projetos", order: 0, published: true }
  assert.equal(parseLinkInput(base).appearance, "description")
  assert.equal(parseLinkInput({ ...base, icon: "linkedin" }).icon, "globe")
  const timed = parseLinkInput({ ...base, startsAt: "2026-11-25T09:00:00-03:00", endsAt: "2026-11-26T00:00:00Z" })
  assert.equal(timed.startsAt, "2026-11-25T12:00:00.000Z")
  for (const bad of [{ cover: "javascript:alert(1)" }, { cover: {} }, { coverAlt: 1 }, { appearance: "html" }, { startsAt: "not a date" }, { startsAt: "2026-02-30T00:00:00Z" }, { startsAt: "2026-11-26T00:00:00Z", endsAt: "2026-11-25T00:00:00Z" }]) assert.throws(() => parseLinkInput({ ...base, ...bad }))
})
test("batch duplicate detection normalizes hosts, fragments, query order and trailing slashes", () => {
  assert.equal(canonicalLinkURL("EXAMPLE.com/path/#part"), canonicalLinkURL("https://example.com/path"))
  assert.equal(canonicalLinkURL("https://example.com/?b=2&a=1"), canonicalLinkURL("https://example.com/?a=1&b=2"))
  assert.notEqual(canonicalLinkURL("https://example.com/?a=1"), canonicalLinkURL("https://example.com/?a=2"))
})
