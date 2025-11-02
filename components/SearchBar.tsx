"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useAnalytics } from "@components/analytics/AnalyticsProvider";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";

interface SearchBarProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
  rightSlot?: ReactNode;
}

export default function SearchBar({ onSearch, initialQuery = "", rightSlot }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const { trackEvent, isTrackingEnabled } = useAnalytics();

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
    const q = query.trim();
    onSearch(q);
    if (isTrackingEnabled && q) {
      // Evento opcional: busca executada
      trackEvent("search_query", { query: q });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 w-[30vw] min-w-[220px] sm:w-1/3 md:w-[360px]">
        <MagnifyingGlassIcon className="w-4 h-4" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar posts"
          aria-label="Pesquisar posts"
          className="bg-transparent outline-none placeholder-zinc-500 dark:placeholder-zinc-300 flex-1 min-w-0"
        />
        {rightSlot && (
          <>
            <span className="h-4 w-px bg-zinc-500/20" aria-hidden />
            <div className="flex items-center">{rightSlot}</div>
          </>
        )}
      </div>
    </form>
  );
}







