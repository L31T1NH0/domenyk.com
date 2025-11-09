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
      <div className="card-surface-interactive flex items-center gap-3 px-3 py-2 w-full sm:w-auto">
        <MagnifyingGlassIcon
          className="h-5 w-5 text-zinc-500 dark:text-zinc-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar"
          aria-label="Pesquisar"
          className="form-input-plain flex-1 min-w-0 text-sm placeholder-zinc-500 dark:placeholder-zinc-300"
        />
        {rightSlot && (
          <div className="flex items-center gap-3">
            <span className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
            <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-300">
              {rightSlot}
            </div>
          </div>
        )}
      </div>
    </form>
  );
}







