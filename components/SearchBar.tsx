"use client";

import { useState, useEffect, useRef } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";

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
      <div className="relative">
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-zinc-500/20 rounded px-1 py-0.5">
        <MagnifyingGlassIcon className="w-4 h-4" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Pesquisar posts..."
            className="bg-transparent outline-none  placeholder-zinc-400">
            </input>
        </div>
      </div>
  );
}