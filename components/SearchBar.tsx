"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { cn } from "@lib/cn";

type SearchBarProps = {
  onSearch: (query: string) => void;
  initialQuery?: string;
  rightSlot?: ReactNode;
  className?: string;
};

export default function SearchBar({ onSearch, initialQuery = "", rightSlot, className }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === "k") {
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
    <form onSubmit={handleSubmit} className={cn("w-full", className)}>
      <div className="group flex w-full items-center gap-3 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(22,22,22,0.65)] px-4 py-2 text-sm text-[var(--color-text)] transition focus-within:border-[rgba(255,75,139,0.4)] focus-within:shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
        <MagnifyingGlassIcon className="size-4 text-[var(--color-muted)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar manifestos"
          className="flex-1 min-w-0 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none"
        />
        {rightSlot ? <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">{rightSlot}</div> : null}
      </div>
    </form>
  );
}
