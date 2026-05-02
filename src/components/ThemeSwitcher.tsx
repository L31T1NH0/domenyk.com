"use client"

import { useState } from "react"
import { SunIcon, MoonIcon } from "@heroicons/react/20/solid"

export function ThemeSwitcher() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return true
    return localStorage.getItem("theme") !== "light"
  })

  function toggle() {
    const next = !darkMode
    setDarkMode(next)
    document.documentElement.classList.toggle("dark-mode", next)
    document.documentElement.classList.toggle("light-mode", !next)
    document.body.classList.toggle("dark-mode", next)
    document.body.classList.toggle("light-mode", !next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }

  return (
    <button onClick={toggle} className="w-8 h-8 rounded-full">
      {darkMode ? <SunIcon width={24} height={24} /> : <MoonIcon width={24} height={24} />}
    </button>
  )
}
