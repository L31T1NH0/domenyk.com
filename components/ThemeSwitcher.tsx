"use client";
import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/20/solid";

export default function ThemeSwitcher() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) {
        return savedTheme === "dark";
      }
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return true;
      }
    }
    return true;
  });

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return;

    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode, isMounted]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const label = darkMode ? "Ativar modo claro" : "Ativar modo escuro";

  return (
    <button
      type="button"
      className="theme-toggle motion-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      onClick={toggleDarkMode}
      aria-pressed={darkMode}
      aria-label={label}
    >
      <span className="theme-toggle__icon" data-state={darkMode ? "visible" : "hidden"} aria-hidden>
        <SunIcon className="h-4 w-4" />
      </span>
      <span className="theme-toggle__icon" data-state={darkMode ? "hidden" : "visible"} aria-hidden>
        <MoonIcon className="h-4 w-4" />
      </span>
      <span className="theme-toggle__label">Modo</span>
    </button>
  );
}
