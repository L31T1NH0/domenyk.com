"use client";

import { useMemo } from "react";

interface LexicalEditorProps {
  value: string;
  onChange: (value: string) => void;
  onFocusChange?: (isFocused: boolean) => void;
  appearance?: "panel" | "inline";
}

export default function LexicalEditor({
  value,
  onChange,
  onFocusChange,
  appearance = "panel",
}: LexicalEditorProps) {
  const containerClass = useMemo(
    () =>
      [
        "relative overflow-hidden",
        appearance === "panel"
          ? "rounded-2xl border border-white/5 bg-gradient-to-b from-[#0b0d12] via-[#0d1016] to-[#0a0c11] shadow-[0_30px_80px_-60px_rgba(0,0,0,0.9)]"
          : "rounded-xl border border-white/10 bg-transparent backdrop-blur",
      ]
        .filter(Boolean)
        .join(" "),
    [appearance]
  );

  return (
    <div className={containerClass}>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          placeholder="Comece a escrever…"
          className="min-h-[350px] w-full resize-none bg-transparent px-4 pb-6 pt-4 text-base leading-relaxed text-zinc-100 caret-emerald-400 focus:outline-none font-['IAWriterQuattroV-Italic',serif]"
          spellCheck={false}
          aria-label="Área principal de conteúdo"
        />
      </div>
    </div>
  );
}
