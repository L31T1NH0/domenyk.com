"use client";
import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/24/solid";

export default function ThemeSwitcher() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) {
        return savedTheme === "dark";
      } else {
        // Prioriza modo escuro como padrão, mas respeita prefers-color-scheme
        return (
          (window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches) ||
          true
        ); // Fallback para dark mode
      }
    }
    return true; // Valor padrão para SSR: modo escuro
  });

  const [isMounted, setIsMounted] = useState(false); // Estado para controlar o primeiro render

  useEffect(() => {
    setIsMounted(true); // Marca que o componente está montado
  }, []);

  useEffect(() => {
    if (isMounted && typeof window !== "undefined") {
      if (darkMode) {
        document.body.classList.add("dark-mode");
        document.body.classList.remove("light-mode");
        localStorage.setItem("theme", "dark");
      } else {
        document.body.classList.add("light-mode");
        document.body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
      }
    }
  }, [darkMode, isMounted]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <button className="fixed" onClick={toggleDarkMode}>
      {darkMode ? (
        <SunIcon className="svg-icon" width={24} height={24} />
      ) : (
        <MoonIcon className="svg-icon" width={24} height={24} />
      )}
    </button>
  );
}
