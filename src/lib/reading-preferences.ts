export const READING_PREFERENCES_STORAGE_KEY = "reading-preferences-v3"
export const LEGACY_READING_PREFERENCES_STORAGE_KEY = "reading-preferences-v2"

export type ReadingPreferenceKey =
  | "fontSize"
  | "lineHeight"
  | "letterSpacing"
  | "blockSpacing"

export type ReadingPreferences = Record<ReadingPreferenceKey, number | null>

export type ReadingPreferenceProfile = "home" | "post"

export type ReadingPreferenceProfiles = Record<ReadingPreferenceProfile, ReadingPreferences>

export type ReadingMetrics = {
  autoFontSize: number
  baseLineHeight: number
  baseBlockSpacing: number
}

export type EffectiveReadingMetrics = {
  fontSize: number
  lineHeight: number
  letterSpacing: number
  blockSpacing: number
}

type ReadingPreferenceRange = {
  min: number
  max: number
  step: number
  precision: number
}

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  fontSize: null,
  lineHeight: null,
  letterSpacing: null,
  blockSpacing: null,
}

export const DEFAULT_READING_PREFERENCE_PROFILES: ReadingPreferenceProfiles = {
  home: { ...DEFAULT_READING_PREFERENCES },
  post: { ...DEFAULT_READING_PREFERENCES },
}

export const DEFAULT_READING_METRICS: ReadingMetrics = {
  autoFontSize: 16,
  baseLineHeight: 1.5,
  baseBlockSpacing: 0.5,
}

export const READING_PREFERENCE_RANGES: Record<ReadingPreferenceKey, ReadingPreferenceRange> = {
  fontSize: { min: 12, max: 24, step: 1, precision: 0 },
  lineHeight: { min: 1.35, max: 2.4, step: 0.05, precision: 3 },
  letterSpacing: { min: 0, max: 0.12, step: 0.005, precision: 3 },
  blockSpacing: { min: 0, max: 2, step: 0.125, precision: 3 },
}

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function baseMetricForPreference(key: ReadingPreferenceKey, metrics: ReadingMetrics) {
  if (key === "fontSize") return metrics.autoFontSize
  if (key === "lineHeight") return metrics.baseLineHeight
  if (key === "blockSpacing") return metrics.baseBlockSpacing
  return 0
}

export function clampReadingPreference(key: ReadingPreferenceKey, value: number) {
  const range = READING_PREFERENCE_RANGES[key]
  const finiteValue = Number.isFinite(value) ? value : range.min
  return roundTo(Math.min(range.max, Math.max(range.min, finiteValue)), range.precision)
}

export function normalizeReadingPreferences(value: unknown): ReadingPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_READING_PREFERENCES }
  const candidate = value as Partial<Record<ReadingPreferenceKey, unknown>>

  return {
    fontSize: typeof candidate.fontSize === "number"
      ? clampReadingPreference("fontSize", candidate.fontSize)
      : null,
    lineHeight: typeof candidate.lineHeight === "number"
      ? clampReadingPreference("lineHeight", candidate.lineHeight)
      : null,
    letterSpacing: typeof candidate.letterSpacing === "number"
      ? clampReadingPreference("letterSpacing", candidate.letterSpacing)
      : null,
    blockSpacing: typeof candidate.blockSpacing === "number"
      ? clampReadingPreference("blockSpacing", candidate.blockSpacing)
      : null,
  }
}

export function normalizeReadingPreferenceProfiles(value: unknown): ReadingPreferenceProfiles {
  if (value && typeof value === "object" && ("home" in value || "post" in value)) {
    const candidate = value as Partial<Record<ReadingPreferenceProfile, unknown>>
    return {
      home: normalizeReadingPreferences(candidate.home),
      post: normalizeReadingPreferences(candidate.post),
    }
  }

  const legacyPreferences = normalizeReadingPreferences(value)
  return {
    home: { ...legacyPreferences },
    post: { ...legacyPreferences },
  }
}

export function readingPreferenceProfileForPathname(pathname: string): ReadingPreferenceProfile {
  return pathname === "/" || pathname === "/notes" ? "home" : "post"
}

export function adjustReadingPreference(
  preferences: ReadingPreferences,
  metrics: ReadingMetrics,
  key: ReadingPreferenceKey,
  direction: -1 | 1
): ReadingPreferences {
  const { step } = READING_PREFERENCE_RANGES[key]
  const currentValue = preferences[key] ?? baseMetricForPreference(key, metrics)
  return {
    ...preferences,
    [key]: clampReadingPreference(key, currentValue + step * direction),
  }
}

export function resetReadingPreference(
  preferences: ReadingPreferences,
  key: ReadingPreferenceKey
): ReadingPreferences {
  return { ...preferences, [key]: null }
}

export function hasCustomReadingPreferences(preferences: ReadingPreferences) {
  return (Object.keys(DEFAULT_READING_PREFERENCES) as ReadingPreferenceKey[])
    .some((key) => preferences[key] !== null)
}

export function effectiveReadingMetrics(
  preferences: ReadingPreferences,
  metrics: ReadingMetrics
): EffectiveReadingMetrics {
  return {
    fontSize: preferences.fontSize ?? metrics.autoFontSize,
    lineHeight: preferences.lineHeight ?? metrics.baseLineHeight,
    letterSpacing: preferences.letterSpacing ?? 0,
    blockSpacing: preferences.blockSpacing ?? metrics.baseBlockSpacing,
  }
}
