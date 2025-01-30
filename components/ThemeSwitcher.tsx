import { useEffect, useState } from "react";

export default function ThemeSwitcher() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) {
        return savedTheme === "dark";
      } else {
        return (
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        );
      }
    }
    return true; // valor padrão
  });

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
  }, []);

  const getCachedImage = (src: string) => {
    if (typeof window !== "undefined" && localStorage) {
      return localStorage.getItem(src) || src;
    }
    return src;
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

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
