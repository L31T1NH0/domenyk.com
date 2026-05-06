"use client"

import { useSyncExternalStore } from "react"
import { SunIcon, MoonIcon } from "@heroicons/react/20/solid"

const THEME_CHANGE_EVENT = "themechange"

function getDarkModeSnapshot() {
  return localStorage.getItem("theme") !== "light"
}

function getServerDarkModeSnapshot() {
  return true
}

function subscribeToThemeChange(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(THEME_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(THEME_CHANGE_EVENT, callback)
  }
}

function applyTheme(darkMode: boolean) {
  document.documentElement.classList.toggle("dark-mode", darkMode)
  document.documentElement.classList.toggle("light-mode", !darkMode)
  document.body.classList.toggle("dark-mode", darkMode)
  document.body.classList.toggle("light-mode", !darkMode)
}

export function ThemeSwitcher() {
  const darkMode = useSyncExternalStore(
    subscribeToThemeChange,
    getDarkModeSnapshot,
    getServerDarkModeSnapshot
  )

  function toggle() {
    const next = !darkMode
    applyTheme(next)
    localStorage.setItem("theme", next ? "dark" : "light")
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  return (
    <button onClick={toggle} className="w-8 h-8 rounded-full">
      {darkMode ? <SunIcon width={24} height={24} /> : <MoonIcon width={24} height={24} />}
    </button>
  )
}
