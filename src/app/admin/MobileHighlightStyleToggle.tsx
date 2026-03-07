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
    <div className="border border-white/8 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#f1f1f1]">Estilo mobile — destaques de parágrafo</p>
        <p className="text-xs text-[#A8A095]">Como indicar destaques e comentários no mobile.</p>
        <div className="mt-1 text-xs">
          {isSaving && <span className="text-[#A8A095]">Salvando...</span>}
          {!isSaving && message && <span className="text-[#E00070]">{message}</span>}
          {!isSaving && error && <span className="text-red-400">{error}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => update("badges")}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
            value === "badges"
              ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#E00070]"
              : "border-white/10 text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1]"
          }`}
        >
          Badges
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => update("border")}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
            value === "border"
              ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#E00070]"
              : "border-white/10 text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1]"
          }`}
        >
          Borda
        </button>
      </div>
    </div>
  );
}
