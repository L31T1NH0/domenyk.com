"use client";

import { useState } from "react";

type Props = { initialValue: "badges" | "border" };

export default function MobileHighlightStyleToggle({ initialValue }: Props) {
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = async (next: "badges" | "border") => {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/admin/api/mobile-highlight-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      setValue(next);
      setMessage("Salvo!");
    } catch {
      setError("Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-50">
            Estilo mobile — destaques de parágrafo
          </p>
          <p className="text-xs text-zinc-400">
            Como indicar destaques e comentários no mobile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => update("badges")}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              value === "badges"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
            ].join(" ")}
          >
            Badges
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => update("border")}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              value === "border"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
            ].join(" ")}
          >
            Borda
          </button>
        </div>
      </div>
      <div className="text-xs text-zinc-400">
        {isSaving && <span className="text-amber-300">Salvando...</span>}
        {!isSaving && message && <span className="text-emerald-300">{message}</span>}
        {!isSaving && error && <span className="text-red-400">{error}</span>}
      </div>
    </div>
  );
}
