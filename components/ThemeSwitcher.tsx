"use client";
import { useEffect, useMemo, useState } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/20/solid";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = window.localStorage.getItem("theme");
  const resolved: Theme =
    stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
        ? "dark"
        : "light";
  document.documentElement.classList.toggle("dark", resolved === "dark");
  return resolved;
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      if (window.localStorage.getItem("theme")) return;
      setTheme(event.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const isDark = theme === "dark";

  const Icon = useMemo(() => (isDark ? SunIcon : MoonIcon), [isDark]);

  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-pressed={isDark}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="sr-only">Alternar tema</span>
    </button>
  );
}
