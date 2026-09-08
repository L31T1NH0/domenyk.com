"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"

export type NoisePreference = "animated" | "static" | "off"

const DEFAULT_NOISE_PREFERENCE: NoisePreference = "off"
const NOISE_PREFERENCE_STORAGE_KEY = "noise"
const NOISE_PREFERENCE_CHANGE_EVENT = "noisepreferencechange"

let volatileNoisePreference: NoisePreference | null = null

type NoisePreferenceContextValue = {
  preference: NoisePreference
  setPreference: (preference: NoisePreference) => void
}

const NoisePreferenceContext = createContext<NoisePreferenceContextValue | null>(null)

function normalizeNoisePreference(value: string | null): NoisePreference {
  if (value === "animated" || value === "static" || value === "off") return value
  return DEFAULT_NOISE_PREFERENCE
}

function getNoisePreferenceSnapshot() {
  if (volatileNoisePreference) return volatileNoisePreference

  try {
    return normalizeNoisePreference(window.localStorage.getItem(NOISE_PREFERENCE_STORAGE_KEY))
  } catch {
    return DEFAULT_NOISE_PREFERENCE
  }
}

function getServerNoisePreferenceSnapshot() {
  return DEFAULT_NOISE_PREFERENCE
}

function subscribeToNoisePreference(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== NOISE_PREFERENCE_STORAGE_KEY) return
    volatileNoisePreference = normalizeNoisePreference(event.newValue)
    onStoreChange()
  }

  window.addEventListener("storage", handleStorage)
  window.addEventListener(NOISE_PREFERENCE_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", handleStorage)
    window.removeEventListener(NOISE_PREFERENCE_CHANGE_EVENT, onStoreChange)
  }
}

function storeNoisePreference(preference: NoisePreference) {
  volatileNoisePreference = preference

  try {
    window.localStorage.setItem(NOISE_PREFERENCE_STORAGE_KEY, preference)
  } catch {
    // The in-memory preference still works when storage is unavailable.
  }

  window.dispatchEvent(new Event(NOISE_PREFERENCE_CHANGE_EVENT))
}

export function NoisePreferenceProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribeToNoisePreference,
    getNoisePreferenceSnapshot,
    getServerNoisePreferenceSnapshot,
  )

  const setPreference = useCallback((nextPreference: NoisePreference) => {
    storeNoisePreference(nextPreference)
  }, [])

  const value = useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  )

  return (
    <NoisePreferenceContext.Provider value={value}>
      {children}
    </NoisePreferenceContext.Provider>
  )
}

export function useNoisePreference() {
  const context = useContext(NoisePreferenceContext)

  if (!context) {
    throw new Error("useNoisePreference must be used within NoisePreferenceProvider")
  }

  return context
}
