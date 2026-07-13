import assert from "node:assert/strict"
import test from "node:test"

import { estimateNoteReading } from "../src/lib/note-reading.ts"
import { isNoteViewSource, NOTE_VIEW_TTL_MS } from "../src/lib/note-views.ts"

test("accepts only the three internal note view sources", () => {
  assert.equal(isNoteViewSource("direct"), true)
  assert.equal(isNoteViewSource("home"), true)
  assert.equal(isNoteViewSource("notes"), true)
  assert.equal(isNoteViewSource("search"), false)
  assert.equal(NOTE_VIEW_TTL_MS, 86_400_000)
})

test("scales safe view thresholds with note length and complexity", () => {
  const short = estimateNoteReading("Liberdade exige responsabilidade. Sem escolha, não há mérito.")
  const medium = estimateNoteReading(Array.from({ length: 180 }, (_, index) => `palavra${index}`).join(" ") + ".")
  const dense = estimateNoteReading(Array.from({ length: 500 }, () => "institucionalização").join(" ") + ".", 2)

  assert.ok(medium.impressionThresholdMs > short.impressionThresholdMs)
  assert.ok(dense.impressionThresholdMs > medium.impressionThresholdMs)
  assert.equal(dense.impressionThresholdMs, 32_000)
  assert.ok(short.impressionVisibleRatio > dense.impressionVisibleRatio)
  assert.equal(dense.complexity, "densa")
})
