"use client";
import { useEffect, useState } from "react";

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

  const cacheImage = (src: string) => {
    if (!localStorage.getItem(src)) {
      fetch(src)
        .then((response) => response.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            localStorage.setItem(src, reader.result as string);
          };
          reader.readAsDataURL(blob);
        });
    }
  };

  useEffect(() => {
    cacheImage("/images/night-mode-light.svg");
    cacheImage("/images/night-mode-dark.svg");
    setIsMounted(true); // Marca que o componente está montado
  }, []);

  const getCachedImage = (src: string) => {
    if (typeof window !== "undefined" && localStorage) {
      return localStorage.getItem(src) || src;
    }
    return src;
  };

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
    <button onClick={toggleDarkMode}>
      <img
        src={
          darkMode
            ? getCachedImage("/images/night-mode-light.svg")
            : getCachedImage("/images/night-mode-dark.svg")
        }
        alt="Night Mode Icon"
        className="svg-icon"
        width={32}
        height={32}
      />
    </button>
  );
}
