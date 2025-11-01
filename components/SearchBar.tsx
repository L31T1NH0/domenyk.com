"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";

interface SearchBarProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
  rightSlot?: ReactNode;
}

export default function SearchBar({ onSearch, initialQuery = "", rightSlot }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="group flex w-full items-center gap-3 border-b border-neutral-800 pb-3 text-sm uppercase tracking-[0.2em] text-neutral-500 transition-colors focus-within:border-neutral-400 focus-within:text-neutral-300">
        <MagnifyingGlassIcon className="h-4 w-4" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar"
          className="flex-1 min-w-0 bg-transparent text-base font-medium uppercase tracking-[0.25em] text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
        />
        {rightSlot && <div className="flex items-center gap-2 text-[10px] tracking-[0.4em]">{rightSlot}</div>}
      </div>
    </form>
  );
}







