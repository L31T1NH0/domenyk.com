"use client"

import { useSyncExternalStore } from "react"
import { SunIcon, MoonIcon } from "@heroicons/react/20/solid"

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

export function ThemeSwitcher() {
  const { darkMode, toggleTheme } = useThemeSwitcher()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={darkMode ? "Ativar tema claro" : "Ativar tema escuro"}
      title={darkMode ? "Ativar tema claro" : "Ativar tema escuro"}
      className="grid size-10 place-items-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f4f4] dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-[#040404]"
    >
      {darkMode ? <SunIcon width={22} height={22} aria-hidden /> : <MoonIcon width={22} height={22} aria-hidden />}
    </button>
  )
}
