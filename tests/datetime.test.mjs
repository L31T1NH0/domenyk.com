import assert from "node:assert/strict"
import test from "node:test"

import {
  formatSiteDate,
  shiftSiteDateKey,
  siteCalendarYear,
  siteDateKey,
  siteDateKeyToInstant,
  startOfSiteDay,
} from "../src/lib/datetime.ts"

test("uses Fortaleza midnight at month and year boundaries", () => {
  assert.equal(siteDateKey(new Date("2026-07-01T02:59:59.999Z")), "2026-06-30")
  assert.equal(siteDateKey(new Date("2026-07-01T03:00:00.000Z")), "2026-07-01")
  assert.equal(siteDateKey(new Date("2027-01-01T02:59:59.999Z")), "2026-12-31")
  assert.equal(siteDateKey(new Date("2027-01-01T03:00:00.000Z")), "2027-01-01")
})

test("shifts calendar dates without overflowing short or leap months", () => {
  assert.equal(shiftSiteDateKey("2026-03-01", -1), "2026-02-28")
  assert.equal(shiftSiteDateKey("2024-03-01", -1), "2024-02-29")
  assert.equal(shiftSiteDateKey("2026-12-31", 1), "2027-01-01")
})

test("converts a Fortaleza calendar day to the correct instant", () => {
  assert.equal(siteDateKeyToInstant("2026-07-01").toISOString(), "2026-07-01T03:00:00.000Z")
  assert.equal(startOfSiteDay(new Date("2026-07-01T02:59:59.999Z")).toISOString(), "2026-06-30T03:00:00.000Z")
  assert.equal(startOfSiteDay(new Date("2026-07-01T03:00:00.000Z")).toISOString(), "2026-07-01T03:00:00.000Z")
})

test("formats the same calendar date regardless of the runtime timezone", () => {
  const instant = new Date("2026-08-01T00:30:00.000Z")
  assert.equal(formatSiteDate(instant, { dateStyle: "long" }), "31 de julho de 2026")
  assert.equal(siteCalendarYear(new Date("2027-01-01T02:00:00.000Z")), 2026)
})

test("rejects impossible calendar dates", () => {
  assert.throws(() => shiftSiteDateKey("2026-02-30", 1), RangeError)
  assert.throws(() => siteDateKeyToInstant("not-a-date"), RangeError)
})
