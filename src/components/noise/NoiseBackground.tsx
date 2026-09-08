"use client"

import { useNoisePreference } from "./NoisePreferenceContext"

export function NoiseBackground() {
  const { preference } = useNoisePreference()

  // Scope the body's background to the public layout without an overlay.
  return <span hidden aria-hidden="true" data-noise-background={preference} />
}
