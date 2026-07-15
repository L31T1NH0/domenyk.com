"use client"

import { useSyncExternalStore } from "react"

const THEME_CHANGE_EVENT = "themechange"
let volatileDarkMode: boolean | null = null

function getDarkModeSnapshot() {
  if (volatileDarkMode !== null) return volatileDarkMode
  try {
    return localStorage.getItem("theme") !== "light"
  } catch {
    return !document.documentElement.classList.contains("light-mode")
  }
}

function getServerDarkModeSnapshot() {
  return true
}

function subscribeToThemeChange(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== "theme" && event.key !== null) return
    volatileDarkMode = null
    callback()
  }

  window.addEventListener("storage", onStorage)
  window.addEventListener(THEME_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(THEME_CHANGE_EVENT, callback)
  }
}

function applyTheme(darkMode: boolean) {
  document.documentElement.classList.toggle("dark-mode", darkMode)
  document.documentElement.classList.toggle("light-mode", !darkMode)
  document.body.classList.toggle("dark-mode", darkMode)
  document.body.classList.toggle("light-mode", !darkMode)
}

export function useThemeSwitcher() {
  const darkMode = useSyncExternalStore(
    subscribeToThemeChange,
    getDarkModeSnapshot,
    getServerDarkModeSnapshot
  )

  function toggleTheme() {
    const next = !darkMode
    volatileDarkMode = next
    applyTheme(next)
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch {
      // The theme still applies for this page when storage is unavailable.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  return { darkMode, toggleTheme }
}
