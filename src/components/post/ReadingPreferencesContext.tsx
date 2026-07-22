"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
import {
  adjustReadingPreference,
  DEFAULT_READING_PREFERENCE_PROFILES,
  DEFAULT_READING_METRICS,
  effectiveReadingMetrics,
  LEGACY_READING_PREFERENCES_STORAGE_KEY,
  normalizeReadingPreferenceProfiles,
  readingPreferenceProfileForPathname,
  READING_PREFERENCES_STORAGE_KEY,
  resetReadingPreference,
  type ReadingMetrics,
  type ReadingPreferenceKey,
  type ReadingPreferences,
  type ReadingPreferenceProfiles,
} from "@/lib/reading-preferences"

type ReadingPreferencesContextValue = {
  preferences: ReadingPreferences
  metrics: ReadingMetrics
  adjustPreference: (key: ReadingPreferenceKey, direction: -1 | 1) => void
  resetPreference: (key: ReadingPreferenceKey) => void
  resetPreferences: () => void
  setMetrics: (metrics: ReadingMetrics) => void
}

const ReadingPreferencesContext = createContext<ReadingPreferencesContextValue | null>(null)
const READING_PREFERENCES_CHANGE_EVENT = "readingpreferenceschange"
const NOTE_READING_LINE_HEIGHT = 1.4
const DEFAULT_READING_PREFERENCE_PROFILES_SERIALIZED = JSON.stringify(DEFAULT_READING_PREFERENCE_PROFILES)
let volatileReadingPreferences: string | null = null

function getReadingPreferencesSnapshot() {
  if (volatileReadingPreferences !== null) return volatileReadingPreferences
  try {
    const storedProfiles = window.localStorage.getItem(READING_PREFERENCES_STORAGE_KEY)
    if (storedProfiles) return storedProfiles

    const legacyPreferences = window.localStorage.getItem(LEGACY_READING_PREFERENCES_STORAGE_KEY)
    return legacyPreferences
      ? JSON.stringify(normalizeReadingPreferenceProfiles(JSON.parse(legacyPreferences)))
      : DEFAULT_READING_PREFERENCE_PROFILES_SERIALIZED
  } catch {
    return DEFAULT_READING_PREFERENCE_PROFILES_SERIALIZED
  }
}

function getServerReadingPreferencesSnapshot() {
  return DEFAULT_READING_PREFERENCE_PROFILES_SERIALIZED
}

function readCurrentReadingPreferenceProfiles() {
  try {
    return normalizeReadingPreferenceProfiles(JSON.parse(getReadingPreferencesSnapshot()))
  } catch {
    return { ...DEFAULT_READING_PREFERENCE_PROFILES }
  }
}

function subscribeToReadingPreferences(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== READING_PREFERENCES_STORAGE_KEY && event.key !== null) return
    volatileReadingPreferences = null
    callback()
  }

  window.addEventListener("storage", onStorage)
  window.addEventListener(READING_PREFERENCES_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(READING_PREFERENCES_CHANGE_EVENT, callback)
  }
}

function storeReadingPreferenceProfiles(profiles: ReadingPreferenceProfiles) {
  const serialized = JSON.stringify(profiles)
  volatileReadingPreferences = serialized
  try {
    window.localStorage.setItem(READING_PREFERENCES_STORAGE_KEY, serialized)
  } catch {
    // Preferences still apply for the current page when storage is unavailable.
  }
  window.dispatchEvent(new Event(READING_PREFERENCES_CHANGE_EVENT))
}

export function ReadingPreferencesProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const serializedPreferences = useSyncExternalStore(
    subscribeToReadingPreferences,
    getReadingPreferencesSnapshot,
    getServerReadingPreferencesSnapshot
  )
  const profiles = useMemo(() => {
    try {
      return normalizeReadingPreferenceProfiles(JSON.parse(serializedPreferences))
    } catch {
      return { ...DEFAULT_READING_PREFERENCE_PROFILES }
    }
  }, [serializedPreferences])
  const preferenceProfile = readingPreferenceProfileForPathname(pathname)
  const preferences = profiles[preferenceProfile]
  const [metrics, setMetrics] = useState<ReadingMetrics>(DEFAULT_READING_METRICS)
  const routeMetrics = useMemo(() => (
    pathname === "/" || pathname === "/notes"
      ? { autoFontSize: 13, baseLineHeight: NOTE_READING_LINE_HEIGHT, baseBlockSpacing: 0.5 }
      : /^\/notes\/[^/]+$/.test(pathname)
        ? { autoFontSize: 15, baseLineHeight: NOTE_READING_LINE_HEIGHT, baseBlockSpacing: 0.5 }
        : metrics
  ), [pathname, metrics])

  const adjustPreference = useCallback((key: ReadingPreferenceKey, direction: -1 | 1) => {
    const currentProfiles = readCurrentReadingPreferenceProfiles()
    storeReadingPreferenceProfiles({
      ...currentProfiles,
      [preferenceProfile]: adjustReadingPreference(
        currentProfiles[preferenceProfile],
        routeMetrics,
        key,
        direction
      ),
    })
  }, [preferenceProfile, routeMetrics])

  const resetPreference = useCallback((key: ReadingPreferenceKey) => {
    const currentProfiles = readCurrentReadingPreferenceProfiles()
    storeReadingPreferenceProfiles({
      ...currentProfiles,
      [preferenceProfile]: resetReadingPreference(currentProfiles[preferenceProfile], key),
    })
  }, [preferenceProfile])

  const resetPreferences = useCallback(() => {
    const currentProfiles = readCurrentReadingPreferenceProfiles()
    storeReadingPreferenceProfiles({
      ...currentProfiles,
      [preferenceProfile]: { ...DEFAULT_READING_PREFERENCE_PROFILES[preferenceProfile] },
    })
  }, [preferenceProfile])

  const value = useMemo(() => ({
    preferences,
    metrics: routeMetrics,
    adjustPreference,
    resetPreference,
    resetPreferences,
    setMetrics,
  }), [preferences, routeMetrics, adjustPreference, resetPreference, resetPreferences])

  return (
    <ReadingPreferencesContext.Provider value={value}>
      {children}
    </ReadingPreferencesContext.Provider>
  )
}

type ReadingPreferencesScopeStyle = CSSProperties & {
  "--reading-font-size": string
  "--reading-line-height": number
  "--reading-letter-spacing": string
  "--reading-block-spacing": string
}

export function ReadingPreferencesScope({ style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { preferences, metrics } = useReadingPreferences()
  const readingMetrics = effectiveReadingMetrics(preferences, metrics)
  const readingStyle: ReadingPreferencesScopeStyle = {
    ...style,
    "--reading-font-size": `${readingMetrics.fontSize}px`,
    "--reading-line-height": readingMetrics.lineHeight,
    "--reading-letter-spacing": `${readingMetrics.letterSpacing}em`,
    "--reading-block-spacing": `${readingMetrics.blockSpacing}rem`,
  }

  return <div {...props} style={readingStyle} />
}

export function useReadingPreferences() {
  const context = useContext(ReadingPreferencesContext)
  if (!context) throw new Error("useReadingPreferences must be used inside ReadingPreferencesProvider")
  return context
}
