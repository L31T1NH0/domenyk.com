import assert from "node:assert/strict"
import test from "node:test"

import { sanitizeSvg } from "../src/lib/svg-sanitizer.ts"

test("reconstructs a safe vector while preserving geometry and themeable paint", () => {
  const source = Buffer.from('<svg viewBox="0 0 20 20"><title>Traço</title><g fill="none" stroke="currentColor"><path d="M1 1 19 19" stroke-width="2"/></g></svg>')
  const result = sanitizeSvg(source).toString("utf8")

  assert.match(result, /^<\?xml version="1\.0" encoding="UTF-8"\?><svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 20 20">/)
  assert.match(result, /<path d="M1 1 19 19" stroke-width="2"><\/path>/)
  assert.doesNotMatch(result, /script|style=/i)
})

test("rejects active content, event handlers, external URLs and doctypes", () => {
  const unsafe = [
    '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>',
    '<svg viewBox="0 0 10 10"><path onload="alert(1)" d="M0 0"/></svg>',
    '<svg viewBox="0 0 10 10"><path fill="url(https://evil.test/a.svg#paint)" d="M0 0"/></svg>',
    '<!DOCTYPE svg><svg viewBox="0 0 10 10"></svg>',
  ]

  for (const source of unsafe) {
    assert.throws(() => sanitizeSvg(Buffer.from(source)))
  }
})
