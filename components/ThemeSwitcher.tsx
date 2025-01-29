import { useEffect, useState } from "react";

export default function ThemeSwitcher() {
  const [darkMode, setDarkMode] = useState(true);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
    } else {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
    }
  }, [darkMode]);

  return (
    <button onClick={toggleDarkMode}>
      <img
        src={darkMode ? "/images/night-mode-light.svg" : "/images/night-mode-dark.svg"}
        alt="Night Mode Icon"
        className="svg-icon"
        width={32}
        height={32}
      />
    </button>
  );
}
