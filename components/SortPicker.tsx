"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildUrl } from "../src/lib/url";
import { ChevronDownIcon } from "@heroicons/react/24/solid";

const OLD_OPTIONS = [
  { label: "Relevância/Default", value: { sort: undefined, order: undefined } },
  { label: "Data (mais antigo)", value: { sort: "date", order: "asc" as const } },
  { label: "Data (mais recente)", value: { sort: "date", order: "desc" as const } },
  { label: "Views (menor ? maior)", value: { sort: "views", order: "asc" as const } },
  { label: "Views (maior ? menor)", value: { sort: "views", order: "desc" as const } },
];

// Novo conjunto sem "Relevância/Default" e alinhado ao padrão visual
const OPTIONS = [
  { label: "Data (mais antigo)", value: { sort: "date", order: "asc" as const } },
  { label: "Data (mais recente)", value: { sort: "date", order: "desc" as const } },
  { label: "Views (menor → maior)", value: { sort: "views", order: "asc" as const } },
  { label: "Views (maior → menor)", value: { sort: "views", order: "desc" as const } },
];

export default function SortPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const sort = sp.get("sort") || undefined;
  const order = sp.get("order") || undefined;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentKey = `${sort ?? ""}:${order ?? ""}`;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keyup", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keyup", onEsc);
    };
  }, []);

  function onSelect(key: string) {
    const [s, o] = key.split(":");
    const next = buildUrl(
      pathname,
      sp,
      { sort: (s || undefined) as any, order: (o || undefined) as any },
      { resetPage: true }
    );
    setOpen(false);
    router.push(next);
  }

  const currentLabel = (() => {
    const match = OPTIONS.find(
      (opt) => `${opt.value.sort ?? ""}:${opt.value.order ?? ""}` === currentKey
    );
    return match?.label ?? "Data (mais recente)";
  })();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded px-2 py-1 text-sm border border-zinc-500/20 bg-white/10 backdrop-blur-md hover:bg-white/15 transition-colors"
      >
        <span>{currentLabel}</span>
        <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-zinc-700/50 bg-zinc-900/90 backdrop-blur-md p-1 max-h-[200px] overflow-auto shadow-lg"
        >
          {OPTIONS.map((opt) => {
            const key = `${opt.value.sort ?? ""}:${opt.value.order ?? ""}`;
            const selected = key === currentKey;
            return (
              <button
                key={key}
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(key)}
                className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors hover:bg-white/10 ${
                  selected ? "font-medium text-zinc-100" : "text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
