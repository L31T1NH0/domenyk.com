import assert from "node:assert/strict"
import test from "node:test"

import {
  adjustReadingPreference,
  DEFAULT_READING_METRICS,
  DEFAULT_READING_PREFERENCE_PROFILES,
  DEFAULT_READING_PREFERENCES,
  effectiveReadingMetrics,
  hasCustomReadingPreferences,
  normalizeReadingPreferenceProfiles,
  normalizeReadingPreferences,
  readingPreferenceProfileForPathname,
  resetReadingPreference,
} from "../src/lib/reading-preferences.ts"

test("normalizes stored reading preferences and keeps them inside universal limits", () => {
  assert.deepEqual(normalizeReadingPreferences({
    fontSize: 99,
    lineHeight: -99,
    letterSpacing: -1,
    blockSpacing: 0.376,
  }), {
    fontSize: 24,
    lineHeight: 1.35,
    letterSpacing: 0,
    blockSpacing: 0.376,
  })

  assert.deepEqual(normalizeReadingPreferences(null), DEFAULT_READING_PREFERENCES)
})

test("starts granular adjustments from the current automatic metrics", () => {
  let preferences = { ...DEFAULT_READING_PREFERENCES }
  preferences = adjustReadingPreference(preferences, DEFAULT_READING_METRICS, "fontSize", 1)
  preferences = adjustReadingPreference(preferences, DEFAULT_READING_METRICS, "lineHeight", 1)
  preferences = adjustReadingPreference(preferences, DEFAULT_READING_METRICS, "letterSpacing", 1)
  preferences = adjustReadingPreference(preferences, DEFAULT_READING_METRICS, "blockSpacing", 1)

  assert.deepEqual(preferences, {
    fontSize: 17,
    lineHeight: 1.55,
    letterSpacing: 0.005,
    blockSpacing: 0.625,
  })
  assert.equal(hasCustomReadingPreferences(preferences), true)
  assert.equal(resetReadingPreference(preferences, "letterSpacing").letterSpacing, null)
})

test("keeps home and detailed-reading preferences independent", () => {
  const profiles = normalizeReadingPreferenceProfiles({
    home: { fontSize: 13 },
    post: { fontSize: 17 },
  })

  assert.equal(effectiveReadingMetrics(profiles.home, {
    autoFontSize: 13,
    baseLineHeight: 1.4,
    baseBlockSpacing: 0.5,
  }).fontSize, 13)
  assert.equal(effectiveReadingMetrics(profiles.post, DEFAULT_READING_METRICS).fontSize, 17)
})

test("migrates the previous shared preference into both profiles", () => {
  const legacyPreferences = {
    fontSize: 16,
    lineHeight: 1.6,
    letterSpacing: 0.01,
    blockSpacing: 0.75,
  }

  assert.deepEqual(normalizeReadingPreferenceProfiles(legacyPreferences), {
    home: legacyPreferences,
    post: legacyPreferences,
  })
  assert.deepEqual(normalizeReadingPreferenceProfiles(null), DEFAULT_READING_PREFERENCE_PROFILES)
})

test("maps timelines and detailed pages to their reading profiles", () => {
  assert.equal(readingPreferenceProfileForPathname("/"), "home")
  assert.equal(readingPreferenceProfileForPathname("/notes"), "home")
  assert.equal(readingPreferenceProfileForPathname("/notes/abc"), "post")
  assert.equal(readingPreferenceProfileForPathname("/posts/exemplo"), "post")
  assert.equal(readingPreferenceProfileForPathname("/en/posts/example"), "post")
})

test("uses the compact automatic metrics for notes", () => {
  assert.deepEqual(effectiveReadingMetrics(DEFAULT_READING_PREFERENCES, {
    autoFontSize: 13,
    baseLineHeight: 1.4,
    baseBlockSpacing: 0.5,
  }), {
    fontSize: 13,
    lineHeight: 1.4,
    letterSpacing: 0,
    blockSpacing: 0.5,
  })
})

test("uses 16px, 1.500 line height, and 0.500rem block spacing for posts", () => {
  assert.deepEqual(effectiveReadingMetrics(DEFAULT_READING_PREFERENCES, DEFAULT_READING_METRICS), {
    fontSize: 16,
    lineHeight: 1.5,
    letterSpacing: 0,
    blockSpacing: 0.5,
  })
})
