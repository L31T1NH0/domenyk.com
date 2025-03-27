"use client";

import { useState, useEffect, useRef } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Foco no input ao pressionar Command + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Atualiza a query e chama onSearch a cada mudança no input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    onSearch(newQuery.trim()); // Chama onSearch dinamicamente
  };

  return (
    <div className=" max-w-xs">
      <div className="relative">
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-2 py-1 shadow-lg">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Pesquisar posts..."
            className="flex-1 bg-transparent outline-none text-white placeholder-gray-400"
          />
        </div>
      </div>
    </div>
  );
}